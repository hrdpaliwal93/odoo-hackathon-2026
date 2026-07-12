import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { id: cycleId } = await params;

    // Verify cycle exists and is not already closed
    const cycleRes = await query('SELECT name, status FROM audit_cycles WHERE id = $1', [cycleId]);
    if (cycleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Audit cycle not found' }, { status: 404 });
    }
    if (cycleRes.rows[0].status === 'Closed') {
      return NextResponse.json({ error: 'Audit cycle already closed' }, { status: 400 });
    }

    // Fetch checking stats
    const checksRes = await query(
      `SELECT status, asset_id as "assetId" FROM audit_asset_checks WHERE audit_cycle_id = $1`,
      [cycleId]
    );

    let verifiedCount = 0;
    let missingCount = 0;
    let damagedCount = 0;
    const missingAssetIds: string[] = [];
    const damagedAssetIds: string[] = [];

    for (const check of checksRes.rows) {
      if (check.status === 'Verified') verifiedCount++;
      else if (check.status === 'Missing') {
        missingCount++;
        missingAssetIds.push(check.assetId);
      } else if (check.status === 'Damaged') {
        damagedCount++;
        damagedAssetIds.push(check.assetId);
      }
    }

    // Auto-update missing assets status to 'Lost'
    for (const assetId of missingAssetIds) {
      await query(
        `UPDATE assets SET status = 'Lost', updated_at = NOW() WHERE id = $1`,
        [assetId]
      );
    }

    // Auto-update damaged assets condition to 'Poor'
    for (const assetId of damagedAssetIds) {
      await query(
        `UPDATE assets SET condition = 'Poor', updated_at = NOW() WHERE id = $1`,
        [assetId]
      );
    }

    const report = `Audit Cycle: ${cycleRes.rows[0].name}. Summary results - Verified: ${verifiedCount}, Missing (Marked Lost): ${missingCount}, Damaged (Marked Poor condition): ${damagedCount}. Total assets audited: ${checksRes.rows.length}.`;

    // Close and write discrepancy report
    await query(
      `UPDATE audit_cycles
       SET status = 'Closed', discrepancy_report = $1
       WHERE id = $2`,
      [report, cycleId]
    );

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        manager.id,
        'Audit Cycle Closed',
        'audit_cycles',
        cycleId,
        `Closed audit cycle ${cycleRes.rows[0].name} with report: ${report}`
      ]
    );

    return NextResponse.json({ message: 'Audit cycle closed and locked successfully', report });
  } catch (error: any) {
    console.error('Close Audit Cycle Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
