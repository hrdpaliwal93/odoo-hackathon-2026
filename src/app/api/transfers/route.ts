import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get transfers
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // all, pending, my-requests, my-approvals

    let sql = `
      SELECT tr.id, tr.asset_id as "assetId", tr.source_user_id as "sourceUserId", tr.target_user_id as "targetUserId",
             tr.department_id as "departmentId", tr.status, tr.approved_by_user_id as "approvedByUserId",
             tr.created_at as "createdAt", tr.updated_at as "updatedAt",
             a.name as "assetName", a.asset_tag as "assetTag",
             u_src.name as "sourceUserName", u_dst.name as "targetUserName",
             d.name as "departmentName"
      FROM transfer_requests tr
      JOIN assets a ON tr.asset_id = a.id
      JOIN users u_src ON tr.source_user_id = u_src.id
      JOIN users u_dst ON tr.target_user_id = u_dst.id
      LEFT JOIN departments d ON tr.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (filter === 'pending') {
      sql += ` AND tr.status = 'Pending'`;
    } else if (filter === 'my-requests') {
      sql += ` AND (tr.source_user_id = $${paramIdx} OR tr.target_user_id = $${paramIdx})`;
      params.push(user.id);
      paramIdx++;
    }

    sql += ' ORDER BY tr.created_at DESC';

    const res = await query(sql, params);
    return NextResponse.json({ transfers: res.rows });
  } catch (error: any) {
    console.error('Get Transfers Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Request transfer
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, targetUserId } = await req.json();

    if (!assetId || !targetUserId) {
      return NextResponse.json({ error: 'Missing assetId or targetUserId' }, { status: 400 });
    }

    // Verify asset is currently allocated and retrieve current holder
    const assetRes = await query(
      `SELECT id, status, current_holder_id as "currentHolderId", current_department_id as "currentDepartmentId", name
       FROM assets WHERE id = $1`,
      [assetId]
    );

    if (assetRes.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assetRes.rows[0];

    if (asset.status !== 'Allocated' || !asset.currentHolderId) {
      return NextResponse.json({ error: 'Transfer requests can only be raised for currently allocated assets' }, { status: 400 });
    }

    if (asset.currentHolderId === targetUserId) {
      return NextResponse.json({ error: 'Target user is already the current holder of this asset' }, { status: 400 });
    }

    const crypto = require('crypto');
    const requestId = crypto.randomUUID();

    // Create transfer request
    await query(
      `INSERT INTO transfer_requests (id, asset_id, source_user_id, target_user_id, department_id, status)
       VALUES ($1, $2, $3, $4, $5, 'Pending')`,
      [
        requestId,
        assetId,
        asset.currentHolderId,
        targetUserId,
        asset.currentDepartmentId || null
      ]
    );

    // Notify current holder and asset managers
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, 'warning')`,
      [
        crypto.randomUUID(),
        asset.currentHolderId,
        `A transfer request has been initiated for your asset: ${asset.name}.`,
        'warning'
      ]
    );

    return NextResponse.json({ message: 'Transfer request submitted successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Request Transfer Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Approve / Reject transfer
export async function PUT(req: NextRequest) {
  try {
    const approver = await getAuthenticatedUser(req);
    if (!approver || !['Admin', 'AssetManager', 'DepartmentHead'].includes(approver.role)) {
      return NextResponse.json({ error: 'Unauthorized role to approve transfers' }, { status: 403 });
    }

    const { requestId, status } = await req.json(); // Approved or Rejected

    if (!requestId || !status || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json({ error: 'Missing requestId or invalid status' }, { status: 400 });
    }

    // Fetch transfer request details
    const requestRes = await query(
      `SELECT tr.id, tr.asset_id as "assetId", tr.source_user_id as "sourceUserId", tr.target_user_id as "targetUserId",
              tr.status, a.name as "assetName", a.asset_tag as "assetTag"
       FROM transfer_requests tr
       JOIN assets a ON tr.asset_id = a.id
       WHERE tr.id = $1`,
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
    }

    const tr = requestRes.rows[0];

    if (tr.status !== 'Pending') {
      return NextResponse.json({ error: 'Transfer request already processed' }, { status: 400 });
    }

    const crypto = require('crypto');

    if (status === 'Rejected') {
      await query(
        `UPDATE transfer_requests SET status = 'Rejected', approved_by_user_id = $1, updated_at = NOW() WHERE id = $2`,
        [approver.id, requestId]
      );

      // Notify target user
      await query(
        `INSERT INTO notifications (id, user_id, message, type)
         VALUES ($1, $2, $3, 'info')`,
        [crypto.randomUUID(), tr.targetUserId, `Transfer request for ${tr.assetName} was rejected.`, 'info']
      );

      return NextResponse.json({ message: 'Transfer request rejected successfully' });
    }

    // Process Approval
    // 1. Close current active allocation
    await query(
      `UPDATE asset_allocations
       SET returned_at = NOW(), status = 'Returned', check_in_notes = $1
       WHERE asset_id = $2 AND status = 'Allocated'`,
      [`Transferred to target user ID ${tr.targetUserId} via request ${requestId}`, tr.assetId]
    );

    // 2. Fetch target user's department for new allocation
    const targetUserDeptRes = await query('SELECT department_id as "deptId" FROM users WHERE id = $1', [tr.targetUserId]);
    const targetDeptId = targetUserDeptRes.rows[0]?.deptId || null;

    // 3. Create new allocation
    const allocationId = crypto.randomUUID();
    await query(
      `INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_at, status)
       VALUES ($1, $2, $3, $4, NOW(), 'Allocated')`,
      [allocationId, tr.assetId, tr.targetUserId, targetDeptId]
    );

    // 4. Update asset holder
    await query(
      `UPDATE assets
       SET current_holder_id = $1, current_department_id = $2, status = 'Allocated', updated_at = NOW()
       WHERE id = $3`,
      [tr.targetUserId, targetDeptId, tr.assetId]
    );

    // 5. Update transfer request status
    await query(
      `UPDATE transfer_requests
       SET status = 'Approved', approved_by_user_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [approver.id, requestId]
    );

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        approver.id,
        'Asset Transferred',
        'assets',
        tr.assetId,
        `Transfer approved: ${tr.assetTag} moved from user ${tr.sourceUserId} to ${tr.targetUserId}.`
      ]
    );

    // Notify both users
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, 'success')`,
      [crypto.randomUUID(), tr.targetUserId, `Asset ${tr.assetName} (${tr.assetTag}) has been transferred to you.`, 'success']
    );
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, 'info')`,
      [crypto.randomUUID(), tr.sourceUserId, `Asset ${tr.assetName} (${tr.assetTag}) has been transferred out of your allocation.`, 'info']
    );

    return NextResponse.json({ message: 'Transfer request approved and processed successfully' });
  } catch (error: any) {
    console.error('Approve Transfer Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
