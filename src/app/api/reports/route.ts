import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reports are for Admins and Managers
    if (!['Admin', 'AssetManager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Asset utilization: top allocated assets
    const topAssetsRes = await query(`
      SELECT a.name, a.asset_tag as "assetTag", COUNT(aa.id) as "allocationsCount"
      FROM assets a
      LEFT JOIN asset_allocations aa ON a.id = aa.asset_id
      GROUP BY a.id
      ORDER BY "allocationsCount" DESC
      LIMIT 5
    `);

    // 2. Department-wise allocations
    const deptAllocationsRes = await query(`
      SELECT d.name as "departmentName", COUNT(a.id) as "allocatedCount"
      FROM departments d
      LEFT JOIN assets a ON d.id = a.current_department_id
      WHERE a.status = 'Allocated'
      GROUP BY d.id
      ORDER BY "allocatedCount" DESC
    `);

    // 3. Maintenance frequency by category
    const maintenanceCategoryRes = await query(`
      SELECT ac.name as "categoryName", COUNT(mr.id) as "maintenanceCount"
      FROM asset_categories ac
      LEFT JOIN assets a ON ac.id = a.category_id
      LEFT JOIN maintenance_requests mr ON a.id = mr.asset_id
      GROUP BY ac.id
      ORDER BY "maintenanceCount" DESC
    `);

    // 4. Resource booking heatmap (hourly peak windows)
    const bookingHeatmapRes = await query(`
      SELECT EXTRACT(HOUR FROM start_time) as "hour", COUNT(id) as "bookingsCount"
      FROM resource_bookings
      WHERE status != 'Cancelled'
      GROUP BY "hour"
      ORDER BY "hour" ASC
    `);

    // 5. Assets near retirement (e.g. older than 3 years)
    const nearingRetirementRes = await query(`
      SELECT name, asset_tag as "assetTag", acquisition_date as "acquisitionDate", status, condition
      FROM assets
      WHERE status != 'Retired' AND status != 'Disposed'
        AND acquisition_date < NOW() - INTERVAL '3 years'
      ORDER BY acquisition_date ASC
      LIMIT 10
    `);

    return NextResponse.json({
      topAssets: topAssetsRes.rows,
      deptAllocations: deptAllocationsRes.rows,
      maintenanceCategory: maintenanceCategoryRes.rows,
      bookingHeatmap: bookingHeatmapRes.rows,
      nearingRetirement: nearingRetirementRes.rows,
    });
  } catch (error: any) {
    console.error('Get Reports Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
