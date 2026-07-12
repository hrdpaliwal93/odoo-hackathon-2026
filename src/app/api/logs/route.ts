import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['Admin', 'AssetManager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const res = await query(`
      SELECT al.id, al.action, al.target_type as "targetType", al.target_id as "targetId",
             al.details, al.created_at as "createdAt", u.name as "userName", u.email as "userEmail"
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ logs: res.rows });
  } catch (error: any) {
    console.error('Get Activity Logs Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
