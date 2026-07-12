import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT id, message, type, is_read as "isRead", created_at as "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    return NextResponse.json({ notifications: res.rows });
  } catch (error: any) {
    console.error('Get Notifications Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationId } = await req.json();

    if (notificationId) {
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
        [notificationId, user.id]
      );
    } else {
      // Mark all read
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [user.id]
      );
    }

    return NextResponse.json({ message: 'Notifications updated successfully' });
  } catch (error: any) {
    console.error('Update Notifications Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
