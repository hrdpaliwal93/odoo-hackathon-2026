import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch primary asset details
    const assetRes = await query(
      `SELECT a.id, a.name, a.category_id as "categoryId", a.asset_tag as "assetTag", a.serial_number as "serialNumber",
              a.acquisition_date as "acquisitionDate", a.acquisition_cost as "acquisitionCost", a.condition, a.location,
              a.status, a.is_shared_bookable as "isSharedBookable", a.current_holder_id as "currentHolderId",
              a.current_department_id as "currentDepartmentId", c.name as "categoryName", d.name as "departmentName",
              u.name as "holderName"
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id
       LEFT JOIN departments d ON a.current_department_id = d.id
       LEFT JOIN users u ON a.current_holder_id = u.id
       WHERE a.id = $1`,
      [id]
    );

    if (assetRes.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assetRes.rows[0];

    // Fetch allocation history
    const allocationsRes = await query(
      `SELECT aa.id, aa.allocated_at as "allocatedAt", aa.expected_return_date as "expectedReturnDate",
              aa.returned_at as "returnedAt", aa.check_in_notes as "checkInNotes", aa.status,
              u.name as "userName", u.email as "userEmail", d.name as "departmentName"
       FROM asset_allocations aa
       LEFT JOIN users u ON aa.user_id = u.id
       LEFT JOIN departments d ON aa.department_id = d.id
       WHERE aa.asset_id = $1
       ORDER BY aa.allocated_at DESC`,
      [id]
    );

    // Fetch maintenance history
    const maintenanceRes = await query(
      `SELECT mr.id, mr.description, mr.priority, mr.status, mr.photo_url as "photoUrl",
              mr.assigned_technician as "assignedTechnician", mr.resolution_notes as "resolutionNotes",
              mr.created_at as "createdAt", mr.updated_at as "updatedAt", u.name as "reportedByName"
       FROM maintenance_requests mr
       LEFT JOIN users u ON mr.reported_by_user_id = u.id
       WHERE mr.asset_id = $1
       ORDER BY mr.created_at DESC`,
      [id]
    );

    return NextResponse.json({
      asset,
      allocations: allocationsRes.rows,
      maintenance: maintenanceRes.rows,
    });
  } catch (error: any) {
    console.error('Get Asset Details Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
