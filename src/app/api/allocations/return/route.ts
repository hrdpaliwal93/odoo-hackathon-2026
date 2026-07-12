import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { allocationId, checkInNotes, condition } = await req.json();

    if (!allocationId) {
      return NextResponse.json({ error: 'Missing allocationId' }, { status: 400 });
    }

    // Get allocation details
    const allocationRes = await query(
      `SELECT aa.id, aa.asset_id as "assetId", aa.user_id as "userId", aa.status, a.name as "assetName", a.asset_tag as "assetTag"
       FROM asset_allocations aa
       JOIN assets a ON aa.asset_id = a.id
       WHERE aa.id = $1`,
      [allocationId]
    );

    if (allocationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Allocation record not found' }, { status: 404 });
    }

    const allocation = allocationRes.rows[0];

    if (allocation.status === 'Returned') {
      return NextResponse.json({ error: 'Asset is already returned' }, { status: 400 });
    }

    // Update allocation record
    await query(
      `UPDATE asset_allocations
       SET returned_at = NOW(), check_in_notes = $1, status = 'Returned'
       WHERE id = $2`,
      [checkInNotes || '', allocationId]
    );

    // Revert asset status to Available, and update condition if specified
    const updateAssetQuery = condition
      ? `UPDATE assets SET status = 'Available', current_holder_id = NULL, current_department_id = NULL, condition = $1, updated_at = NOW() WHERE id = $2`
      : `UPDATE assets SET status = 'Available', current_holder_id = NULL, current_department_id = NULL, updated_at = NOW() WHERE id = $1`;
      
    const updateParams = condition ? [condition, allocation.assetId] : [allocation.assetId];
    await query(updateAssetQuery, updateParams);

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        manager.id,
        'Asset Returned',
        'assets',
        allocation.assetId,
        `Asset ${allocation.assetTag} returned. Notes: ${checkInNotes || 'None'}. Condition: ${condition || 'Unchanged'}`
      ]
    );

    // Notify user
    if (allocation.userId) {
      await query(
        `INSERT INTO notifications (id, user_id, message, type)
         VALUES ($1, $2, $3, 'success')`,
        [crypto.randomUUID(), allocation.userId, `Asset return for ${allocation.assetName} (${allocation.assetTag}) was checked in.`, 'success']
      );
    }

    return NextResponse.json({ message: 'Asset return checked in successfully' });
  } catch (error: any) {
    console.error('Check In Asset Return Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
