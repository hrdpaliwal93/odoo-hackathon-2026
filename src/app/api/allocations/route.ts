import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get active or overdue allocations
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'active'; // active, overdue, returned

    let sql = `
      SELECT aa.id, aa.asset_id as "assetId", aa.user_id as "userId", aa.department_id as "departmentId",
             aa.allocated_at as "allocatedAt", aa.expected_return_date as "expectedReturnDate",
             aa.returned_at as "returnedAt", aa.check_in_notes as "checkInNotes", aa.status,
             a.name as "assetName", a.asset_tag as "assetTag",
             u.name as "userName", u.email as "userEmail",
             d.name as "departmentName"
      FROM asset_allocations aa
      JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.user_id = u.id
      LEFT JOIN departments d ON aa.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (filter === 'overdue') {
      sql += ` AND aa.status = 'Allocated' AND aa.expected_return_date < NOW()`;
    } else if (filter === 'active') {
      sql += ` AND aa.status = 'Allocated'`;
    } else if (filter === 'returned') {
      sql += ` AND aa.status = 'Returned'`;
    }

    sql += ' ORDER BY aa.allocated_at DESC';

    const res = await query(sql, params);
    return NextResponse.json({ allocations: res.rows });
  } catch (error: any) {
    console.error('Get Allocations Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Allocate asset (Asset Manager only)
export async function POST(req: NextRequest) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { assetId, userId, departmentId, expectedReturnDate } = await req.json();

    if (!assetId || (!userId && !departmentId)) {
      return NextResponse.json({ error: 'Missing assetId or allocation target' }, { status: 400 });
    }

    // Check if asset is available
    const assetCheck = await query(
      `SELECT a.id, a.name, a.status, a.asset_tag as "assetTag", u.name as "holderName"
       FROM assets a
       LEFT JOIN users u ON a.current_holder_id = u.id
       WHERE a.id = $1`,
      [assetId]
    );

    if (assetCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assetCheck.rows[0];

    // Conflict Rule: Block if not Available
    if (asset.status !== 'Available') {
      const holder = asset.holderName || 'another department';
      return NextResponse.json({
        error: 'Conflict',
        holderName: holder,
        message: `Asset is currently held by ${holder}.`,
        assetId: asset.id
      }, { status: 409 });
    }

    const crypto = require('crypto');
    const allocationId = crypto.randomUUID();

    // Insert allocation
    await query(
      `INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_at, expected_return_date, status)
       VALUES ($1, $2, $3, $4, NOW(), $5, 'Allocated')`,
      [
        allocationId,
        assetId,
        userId || null,
        departmentId || null,
        expectedReturnDate ? new Date(expectedReturnDate) : null
      ]
    );

    // Update asset status
    await query(
      `UPDATE assets 
       SET status = 'Allocated', current_holder_id = $1, current_department_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [userId || null, departmentId || null, assetId]
    );

    // Log Activity
    const details = userId 
      ? `Allocated asset ${asset.assetTag} to user ID ${userId}`
      : `Allocated asset ${asset.assetTag} to department ID ${departmentId}`;
      
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), manager.id, 'Asset Allocated', 'assets', assetId, details]
    );

    // Notify user if allocated to a specific user
    if (userId) {
      await query(
        `INSERT INTO notifications (id, user_id, message, type)
         VALUES ($1, $2, $3, 'info')`,
        [crypto.randomUUID(), userId, `Asset ${asset.name} (${asset.assetTag}) has been allocated to you.`, 'info']
      );
    }

    return NextResponse.json({ message: 'Asset allocated successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Allocate Asset Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
