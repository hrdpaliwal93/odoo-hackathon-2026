import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get assets (supports search/filter)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || ''; // Asset Tag, Serial, Name
    const categoryId = searchParams.get('categoryId') || '';
    const status = searchParams.get('status') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const location = searchParams.get('location') || '';
    const isShared = searchParams.get('isSharedBookable');

    let sql = `
      SELECT a.id, a.name, a.category_id as "categoryId", a.asset_tag as "assetTag", a.serial_number as "serialNumber",
             a.acquisition_date as "acquisitionDate", a.acquisition_cost as "acquisitionCost", a.condition, a.location,
             a.status, a.is_shared_bookable as "isSharedBookable", a.current_holder_id as "currentHolderId",
             a.current_department_id as "currentDepartmentId", c.name as "categoryName", d.name as "departmentName",
             u.name as "holderName"
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.current_department_id = d.id
      LEFT JOIN users u ON a.current_holder_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      sql += ` AND (LOWER(a.name) LIKE $${paramIdx} OR LOWER(a.asset_tag) LIKE $${paramIdx} OR LOWER(a.serial_number) LIKE $${paramIdx})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIdx++;
    }

    if (categoryId) {
      sql += ` AND a.category_id = $${paramIdx}`;
      params.push(categoryId);
      paramIdx++;
    }

    if (status) {
      sql += ` AND a.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (departmentId) {
      sql += ` AND a.current_department_id = $${paramIdx}`;
      params.push(departmentId);
      paramIdx++;
    }

    if (location) {
      sql += ` AND LOWER(a.location) LIKE $${paramIdx}`;
      params.push(`%${location.toLowerCase()}%`);
      paramIdx++;
    }

    if (isShared !== null && isShared !== undefined) {
      sql += ` AND a.is_shared_bookable = $${paramIdx}`;
      params.push(isShared === 'true');
      paramIdx++;
    }

    sql += ' ORDER BY a.asset_tag DESC';

    const res = await query(sql, params);
    return NextResponse.json({ assets: res.rows });
  } catch (error: any) {
    console.error('Get Assets API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Register a new asset (Asset Manager / Admin only)
export async function POST(req: NextRequest) {
  try {
    const manager = await getAuthenticatedUser(req);
    if (!manager || !['Admin', 'AssetManager'].includes(manager.role)) {
      return NextResponse.json({ error: 'Asset Manager or Admin role required' }, { status: 403 });
    }

    const { name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isSharedBookable } = await req.json();

    if (!name || !categoryId || !serialNumber || !acquisitionDate || !acquisitionCost || !condition || !location) {
      return NextResponse.json({ error: 'Missing required registration fields' }, { status: 400 });
    }

    // Verify category exists
    const checkCat = await query('SELECT name FROM asset_categories WHERE id = $1', [categoryId]);
    if (checkCat.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid category selected' }, { status: 400 });
    }

    // Check unique serial number
    const checkSerial = await query('SELECT id FROM assets WHERE serial_number = $1', [serialNumber]);
    if (checkSerial.rows.length > 0) {
      return NextResponse.json({ error: 'Serial number already registered' }, { status: 400 });
    }

    // Auto-generate Asset Tag: e.g. AF-0001
    // Lock table or run count logic
    const countRes = await query('SELECT count(*) FROM assets');
    const totalCount = parseInt(countRes.rows[0].count, 10);
    const assetTag = `AF-${(totalCount + 1).toString().padStart(4, '0')}`;

    const crypto = require('crypto');
    const assetId = crypto.randomUUID();

    const insertRes = await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_shared_bookable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Available', $10)
       RETURNING id, name, asset_tag as "assetTag", serial_number as "serialNumber", status`,
      [
        assetId,
        name,
        categoryId,
        assetTag,
        serialNumber,
        new Date(acquisitionDate),
        parseFloat(acquisitionCost),
        condition,
        location,
        isSharedBookable || false
      ]
    );

    const newAsset = insertRes.rows[0];

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        manager.id,
        'Asset Registered',
        'assets',
        assetId,
        `Registered asset: ${name} with tag ${assetTag} and serial ${serialNumber}`
      ]
    );

    return NextResponse.json({ asset: newAsset, message: 'Asset registered successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Register Asset API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
