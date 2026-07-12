import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: cycleId } = await params;

    const res = await query(
      `SELECT aac.id, aac.asset_id as "assetId", aac.status, aac.checked_at as "checkedAt",
              a.name as "assetName", a.asset_tag as "assetTag", a.serial_number as "serialNumber",
              a.condition as "assetCondition", a.status as "assetStatus", u.name as "checkedByName"
       FROM audit_asset_checks aac
       JOIN assets a ON aac.asset_id = a.id
       JOIN users u ON aac.checked_by_user_id = u.id
       WHERE aac.audit_cycle_id = $1`,
      [cycleId]
    );

    return NextResponse.json({ checks: res.rows });
  } catch (error: any) {
    console.error('Get Audit Checks Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: cycleId } = await params;
    const { checkId, status } = await req.json(); // Verified, Missing, Damaged

    if (!checkId || !status || !['Verified', 'Missing', 'Damaged'].includes(status)) {
      return NextResponse.json({ error: 'Missing checkId or invalid check status' }, { status: 400 });
    }

    // Verify user is assigned auditor or Admin
    const cycleRes = await query('SELECT status FROM audit_cycles WHERE id = $1', [cycleId]);
    if (cycleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Audit cycle not found' }, { status: 404 });
    }
    if (cycleRes.rows[0].status === 'Closed') {
      return NextResponse.json({ error: 'Audit cycle is closed and locked' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE audit_asset_checks
       SET status = $1, checked_by_user_id = $2, checked_at = NOW()
       WHERE id = $3 AND audit_cycle_id = $4
       RETURNING id, status`,
      [status, user.id, checkId, cycleId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'Check record not found' }, { status: 404 });
    }

    return NextResponse.json({ check: updateRes.rows[0], message: 'Audit check updated successfully' });
  } catch (error: any) {
    console.error('Update Audit Check Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
