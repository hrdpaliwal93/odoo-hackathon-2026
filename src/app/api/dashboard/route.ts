import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Core KPIs counts
    const availableRes = await query("SELECT COUNT(*) FROM assets WHERE status = 'Available'");
    const allocatedRes = await query("SELECT COUNT(*) FROM assets WHERE status = 'Allocated'");
    
    const maintenanceRes = await query(`
      SELECT COUNT(*) FROM maintenance_requests 
      WHERE status IN ('Approved', 'Technician Assigned', 'In Progress') 
         OR (created_at::date = CURRENT_DATE)
    `);

    const bookingsRes = await query("SELECT COUNT(*) FROM resource_bookings WHERE status IN ('Upcoming', 'Ongoing')");
    const transfersRes = await query("SELECT COUNT(*) FROM transfer_requests WHERE status = 'Pending'");
    
    const upcomingReturnsRes = await query(`
      SELECT COUNT(*) FROM asset_allocations 
      WHERE status = 'Allocated' AND expected_return_date >= NOW()
    `);

    const overdueReturnsRes = await query(`
      SELECT COUNT(*) FROM asset_allocations 
      WHERE status = 'Allocated' AND expected_return_date < NOW()
    `);

    // 2. Overdue returns detail list
    const overdueDetailsRes = await query(`
      SELECT aa.id, aa.expected_return_date as "expectedReturnDate",
             a.name as "assetName", a.asset_tag as "assetTag",
             u.name as "userName", u.email as "userEmail"
      FROM asset_allocations aa
      JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.user_id = u.id
      WHERE aa.status = 'Allocated' AND aa.expected_return_date < NOW()
      ORDER BY aa.expected_return_date ASC
      LIMIT 10
    `);

    return NextResponse.json({
      kpis: {
        available: parseInt(availableRes.rows[0].count, 10),
        allocated: parseInt(allocatedRes.rows[0].count, 10),
        maintenance: parseInt(maintenanceRes.rows[0].count, 10),
        activeBookings: parseInt(bookingsRes.rows[0].count, 10),
        pendingTransfers: parseInt(transfersRes.rows[0].count, 10),
        upcomingReturns: parseInt(upcomingReturnsRes.rows[0].count, 10),
        overdueReturns: parseInt(overdueReturnsRes.rows[0].count, 10),
      },
      overdueReturns: overdueDetailsRes.rows,
    });
  } catch (error: any) {
    console.error('Get Dashboard Details Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
