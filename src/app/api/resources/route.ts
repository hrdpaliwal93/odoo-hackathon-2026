import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get resources
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query('SELECT id, name, description, category, location FROM resources ORDER BY name ASC');
    return NextResponse.json({ resources: res.rows });
  } catch (error: any) {
    console.error('Get Resources Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Create a resource (Admin or AssetManager only)
export async function POST(req: NextRequest) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { name, description, category, location } = await req.json();

    if (!name || !category || !location) {
      return NextResponse.json({ error: 'Missing required resource fields' }, { status: 400 });
    }

    // Verify category matches check constraint
    if (!['Room', 'Vehicle', 'Equipment'].includes(category)) {
      return NextResponse.json({ error: 'Invalid resource category' }, { status: 400 });
    }

    const crypto = require('crypto');
    const id = crypto.randomUUID();

    const insertRes = await query(
      `INSERT INTO resources (id, name, description, category, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, category, location`,
      [id, name, description || '', category, location]
    );

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), manager.id, 'Resource Created', 'resources', id, `Created resource: ${name} (${category})`]
    );

    return NextResponse.json({ resource: insertRes.rows[0], message: 'Resource created successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Resource Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
