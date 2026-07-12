import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get maintenance requests
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let sql = `
      SELECT mr.id, mr.asset_id as "assetId", mr.reported_by_user_id as "reportedByUserId", mr.description,
             mr.priority, mr.photo_url as "photoUrl", mr.status, mr.assigned_technician as "assignedTechnician",
             mr.resolution_notes as "resolutionNotes", mr.created_at as "createdAt", mr.updated_at as "updatedAt",
             a.name as "assetName", a.asset_tag as "assetTag", u.name as "reportedByName"
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      JOIN users u ON mr.reported_by_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter based on role: Employees see their own reports, Managers see everything
    if (user.role === 'Employee') {
      sql += ` AND mr.reported_by_user_id = $1`;
      params.push(user.id);
    }

    sql += ' ORDER BY mr.created_at DESC';

    const res = await query(sql, params);
    return NextResponse.json({ maintenance: res.rows });
  } catch (error: any) {
    console.error('Get Maintenance Tickets Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Raise a maintenance request (Any authenticated user)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, description, priority, photoUrl } = await req.json();

    if (!assetId || !description) {
      return NextResponse.json({ error: 'Missing assetId or issue description' }, { status: 400 });
    }

    // Verify asset exists
    const assetCheck = await query('SELECT name, asset_tag as "assetTag" FROM assets WHERE id = $1', [assetId]);
    if (assetCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    const asset = assetCheck.rows[0];

    const crypto = require('crypto');
    const requestId = crypto.randomUUID();

    // Create ticket
    await query(
      `INSERT INTO maintenance_requests (id, asset_id, reported_by_user_id, description, priority, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending')`,
      [requestId, assetId, user.id, description, priority || 'Medium', photoUrl || null]
    );

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), user.id, 'Maintenance Requested', 'assets', assetId, `Reported maintenance for ${asset.assetTag}: ${description}`]
    );

    return NextResponse.json({ message: 'Maintenance request submitted successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Maintenance Ticket Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Update maintenance workflow (Asset Managers or Admin only)
export async function PUT(req: NextRequest) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { requestId, status, assignedTechnician, resolutionNotes } = await req.json();

    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 });
    }

    // Fetch request
    const ticketRes = await query(
      `SELECT mr.id, mr.asset_id as "assetId", mr.reported_by_user_id as "reportedByUserId", mr.status,
              a.name as "assetName", a.asset_tag as "assetTag"
       FROM maintenance_requests mr
       JOIN assets a ON mr.asset_id = a.id
       WHERE mr.id = $1`,
      [requestId]
    );

    if (ticketRes.rows.length === 0) {
      return NextResponse.json({ error: 'Maintenance ticket not found' }, { status: 404 });
    }

    const ticket = ticketRes.rows[0];

    // Build update query
    const updates: string[] = [];
    const params: any[] = [status];
    let paramIndex = 2;

    updates.push(`status = $1`);

    if (assignedTechnician !== undefined) {
      updates.push(`assigned_technician = $${paramIndex++}`);
      params.push(assignedTechnician);
    }
    if (resolutionNotes !== undefined) {
      updates.push(`resolution_notes = $${paramIndex++}`);
      params.push(resolutionNotes);
    }

    params.push(requestId);
    const updateText = `
      UPDATE maintenance_requests
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;

    await query(updateText, params);

    // Dynamic Asset status transitions
    // - On Approval -> Asset status goes to 'Under Maintenance'
    // - On Resolution -> Asset status goes back to 'Available'
    if (status === 'Approved') {
      await query(`UPDATE assets SET status = 'Under Maintenance', updated_at = NOW() WHERE id = $1`, [ticket.assetId]);
    } else if (status === 'Resolved') {
      await query(`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = $1`, [ticket.assetId]);
    }

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        manager.id,
        'Maintenance Ticket Updated',
        'assets',
        ticket.assetId,
        `Ticket ID ${requestId} status updated to ${status}.`
      ]
    );

    // Notify original reporting employee
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, 'info')`,
      [
        crypto.randomUUID(),
        ticket.reportedByUserId,
        `Your maintenance ticket for ${ticket.assetName} (${ticket.assetTag}) status changed to: ${status}.`,
        status === 'Resolved' ? 'success' : 'info'
      ]
    );

    return NextResponse.json({ message: `Maintenance request ${status.toLowerCase()} successfully` });
  } catch (error: any) {
    console.error('Update Maintenance Ticket Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
