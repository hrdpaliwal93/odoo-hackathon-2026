import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get categories
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(`
      SELECT c.id, c.name, c.custom_fields as "customFields", c.created_at as "createdAt",
             (SELECT COUNT(*) FROM assets WHERE category_id = c.id) as "assetCount"
      FROM asset_categories c
      ORDER BY c.name ASC
    `);

    return NextResponse.json({ categories: res.rows });
  } catch (error: any) {
    console.error('Get Categories API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Create category (Admin only)
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { name, customFields } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check unique category name
    const checkCat = await query('SELECT id FROM asset_categories WHERE LOWER(name) = LOWER($1)', [name]);
    if (checkCat.rows.length > 0) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 });
    }

    const crypto = require('crypto');
    const id = crypto.randomUUID();

    const insertRes = await query(
      `INSERT INTO asset_categories (id, name, custom_fields)
       VALUES ($1, $2, $3)
       RETURNING id, name, custom_fields as "customFields"`,
      [id, name, customFields ? JSON.stringify(customFields) : null]
    );

    const newCat = insertRes.rows[0];

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), adminUser.id, 'Category Created', 'categories', id, `Created category: ${name}`]
    );

    return NextResponse.json({ category: newCat, message: 'Category created successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Category API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Edit category (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { id, name, customFields } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing category details' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE asset_categories
       SET name = $1, custom_fields = $2
       WHERE id = $3
       RETURNING id, name, custom_fields as "customFields"`,
      [name, customFields ? JSON.stringify(customFields) : null, id]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), adminUser.id, 'Category Updated', 'categories', id, `Updated category: ${name}`]
    );

    return NextResponse.json({ category: updateRes.rows[0], message: 'Category updated successfully' });
  } catch (error: any) {
    console.error('Update Category API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
