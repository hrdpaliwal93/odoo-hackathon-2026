import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get all departments
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return departments with head name, parent name, and employee count
    const res = await query(`
      SELECT d.id, d.name, d.head_id as "headId", d.parent_department_id as "parentDepartmentId", d.status, d.created_at as "createdAt",
             u.name as "headName", p.name as "parentName",
             (SELECT COUNT(*) FROM users WHERE department_id = d.id) as "employeeCount"
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments p ON d.parent_department_id = p.id
      ORDER BY d.name ASC
    `);

    return NextResponse.json({ departments: res.rows });
  } catch (error: any) {
    console.error('Get Departments API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Create a department (Admin only)
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { name, headId, parentDepartmentId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    // Check unique department name
    const checkDept = await query('SELECT id FROM departments WHERE LOWER(name) = LOWER($1)', [name]);
    if (checkDept.rows.length > 0) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 });
    }

    const crypto = require('crypto');
    const deptId = crypto.randomUUID();

    const insertRes = await query(
      `INSERT INTO departments (id, name, head_id, parent_department_id, status)
       VALUES ($1, $2, $3, $4, 'Active')
       RETURNING id, name, head_id as "headId", parent_department_id as "parentDepartmentId", status`,
      [deptId, name, headId || null, parentDepartmentId || null]
    );

    const newDept = insertRes.rows[0];

    // If headId is provided, make sure that user becomes DepartmentHead role
    if (headId) {
      await query(
        `UPDATE users SET role = 'DepartmentHead', department_id = $1 WHERE id = $2`,
        [deptId, headId]
      );
    }

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), adminUser.id, 'Department Created', 'departments', deptId, `Created department: ${name}`]
    );

    return NextResponse.json({ department: newDept, message: 'Department created successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Department API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Edit a department (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { id, name, headId, parentDepartmentId, status } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing department details' }, { status: 400 });
    }

    // Prevent recursive parent hierarchy
    if (parentDepartmentId === id) {
      return NextResponse.json({ error: 'Department cannot be its own parent' }, { status: 400 });
    }

    // Fetch previous head to see if we should demote them or update them
    const prevDept = await query('SELECT head_id FROM departments WHERE id = $1', [id]);
    const previousHeadId = prevDept.rows[0]?.head_id;

    const updateRes = await query(
      `UPDATE departments
       SET name = $1, head_id = $2, parent_department_id = $3, status = $4
       WHERE id = $5
       RETURNING id, name, head_id as "headId", parent_department_id as "parentDepartmentId", status`,
      [name, headId || null, parentDepartmentId || null, status, id]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Demote old head if they are no longer head of any department and are a DepartmentHead
    if (previousHeadId && previousHeadId !== headId) {
      const headsCount = await query('SELECT count(*) FROM departments WHERE head_id = $1', [previousHeadId]);
      if (parseInt(headsCount.rows[0].count, 10) === 0) {
        await query(`UPDATE users SET role = 'Employee' WHERE id = $1 AND role = 'DepartmentHead'`, [previousHeadId]);
      }
    }

    // Update new head role
    if (headId) {
      await query(
        `UPDATE users SET role = 'DepartmentHead', department_id = $1 WHERE id = $2`,
        [id, headId]
      );
    }

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), adminUser.id, 'Department Updated', 'departments', id, `Updated department: ${name}`]
    );

    return NextResponse.json({ department: updateRes.rows[0], message: 'Department updated successfully' });
  } catch (error: any) {
    console.error('Update Department API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
