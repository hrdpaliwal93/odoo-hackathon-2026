import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get employee directory
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin, AssetManager, DepartmentHead can read the directory
    if (!['Admin', 'AssetManager', 'DepartmentHead'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const res = await query(`
      SELECT u.id, u.name, u.email, u.role, u.department_id as "departmentId", u.status, d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.name ASC
    `);

    return NextResponse.json({ employees: res.rows });
  } catch (error: any) {
    console.error('Get Employees API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Update employee (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { employeeId, role, departmentId, status } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    // Verify user exists
    const checkUser = await query('SELECT email, role, department_id, status FROM users WHERE id = $1', [employeeId]);
    if (checkUser.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    const currentData = checkUser.rows[0];

    // Build updates dynamic query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (departmentId !== undefined) {
      updates.push(`department_id = $${paramIndex++}`);
      params.push(departmentId === '' ? null : departmentId);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(employeeId);
    const queryText = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${paramIndex}
      RETURNING id, name, email, role, department_id as "departmentId", status
    `;

    const res = await query(queryText, params);
    const updatedUser = res.rows[0];

    // Log action in activity logs
    const crypto = require('crypto');
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        adminUser.id,
        'Employee Updated',
        'users',
        updatedUser.id,
        `Promoted/Modified role to ${role || currentData.role}, Dept ID to ${departmentId || currentData.department_id}, Status to ${status || currentData.status}`
      ]
    );

    // Create Notification for the affected user
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, $4)`,
      [
        crypto.randomUUID(),
        updatedUser.id,
        `Your organization details have been updated. Role: ${updatedUser.role}, Status: ${updatedUser.status}`,
        'info'
      ]
    );

    return NextResponse.json({ employee: updatedUser, message: 'Employee updated successfully' });
  } catch (error: any) {
    console.error('Update Employee API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
