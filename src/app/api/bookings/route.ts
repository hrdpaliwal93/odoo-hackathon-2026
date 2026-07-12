import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get resource bookings
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId') || '';

    let sql = `
      SELECT rb.id, rb.resource_id as "resourceId", rb.user_id as "userId", rb.department_id as "departmentId",
             rb.start_time as "startTime", rb.end_time as "endTime", rb.status, rb.created_at as "createdAt",
             r.name as "resourceName", r.category as "resourceCategory", u.name as "userName", d.name as "departmentName"
      FROM resource_bookings rb
      JOIN resources r ON rb.resource_id = r.id
      JOIN users u ON rb.user_id = u.id
      LEFT JOIN departments d ON rb.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (resourceId) {
      sql += ` AND rb.resource_id = $${paramIdx}`;
      params.push(resourceId);
      paramIdx++;
    }

    sql += ' ORDER BY rb.start_time ASC';

    const res = await query(sql, params);
    return NextResponse.json({ bookings: res.rows });
  } catch (error: any) {
    console.error('Get Bookings Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Book a resource with overlap validation
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceId, startTime, endTime } = await req.json();

    if (!resourceId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing booking details' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return NextResponse.json({ error: 'Start time must be before end time' }, { status: 400 });
    }

    // Overlap validation logic:
    // Check if any booking for same resource exists where start < booking.end AND end > booking.start
    const overlapRes = await query(
      `SELECT rb.id, rb.start_time as "startTime", rb.end_time as "endTime", u.name as "userName"
       FROM resource_bookings rb
       JOIN users u ON rb.user_id = u.id
       WHERE rb.resource_id = $1
         AND rb.status != 'Cancelled'
         AND rb.start_time < $3
         AND rb.end_time > $2`,
      [resourceId, start, end]
    );

    if (overlapRes.rows.length > 0) {
      const overlapping = overlapRes.rows[0];
      const startStr = new Date(overlapping.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endStr = new Date(overlapping.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return NextResponse.json({
        error: 'OverlapConflict',
        message: `This resource is already booked by ${overlapping.userName} from ${startStr} to ${endStr}.`
      }, { status: 409 });
    }

    const crypto = require('crypto');
    const bookingId = crypto.randomUUID();

    // Insert booking
    await query(
      `INSERT INTO resource_bookings (id, resource_id, user_id, department_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Upcoming')`,
      [bookingId, resourceId, user.id, user.departmentId || null, start, end]
    );

    // Retrieve resource details for logging/notifications
    const resDetails = await query('SELECT name FROM resources WHERE id = $1', [resourceId]);
    const resourceName = resDetails.rows[0]?.name || 'Resource';

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        user.id,
        'Resource Booked',
        'resources',
        resourceId,
        `Booked resource ${resourceName} from ${start.toISOString()} to ${end.toISOString()}.`
      ]
    );

    // Notify User
    await query(
      `INSERT INTO notifications (id, user_id, message, type)
       VALUES ($1, $2, $3, 'success')`,
      [
        crypto.randomUUID(),
        user.id,
        `Your booking for ${resourceName} starting at ${start.toLocaleString()} is confirmed.`,
        'success'
      ]
    );

    return NextResponse.json({ message: 'Booking confirmed successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Booking Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Cancel Booking
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, status } = await req.json(); // Should be Cancelled

    if (!bookingId || status !== 'Cancelled') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Verify booking and owner
    const bookingRes = await query(
      `SELECT rb.id, rb.user_id as "userId", rb.resource_id as "resourceId", r.name as "resourceName"
       FROM resource_bookings rb
       JOIN resources r ON rb.resource_id = r.id
       WHERE rb.id = $1`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingRes.rows[0];

    // Only booking owner, Admin or AssetManager can cancel
    if (booking.userId !== user.id && !['Admin', 'AssetManager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query(
      `UPDATE resource_bookings SET status = 'Cancelled' WHERE id = $1`,
      [bookingId]
    );

    const crypto = require('crypto');
    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), user.id, 'Booking Cancelled', 'resources', booking.resourceId, `Cancelled booking ID ${bookingId}.`]
    );

    // Notify user if cancelled by someone else
    if (booking.userId !== user.id) {
      await query(
        `INSERT INTO notifications (id, user_id, message, type)
         VALUES ($1, $2, $3, 'warning')`,
        [crypto.randomUUID(), booking.userId, `Your booking for ${booking.resourceName} was cancelled by an administrator.`, 'warning']
      );
    }

    return NextResponse.json({ message: 'Booking cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel Booking Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
