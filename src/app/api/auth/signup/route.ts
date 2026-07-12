import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if email already exists
    const checkEmail = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (checkEmail.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user (defaults to Employee role)
    const crypto = require('crypto');
    const id = crypto.randomUUID();

    const insertUser = await query(
      `INSERT INTO users (id, name, email, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, 'Employee', 'Active') 
       RETURNING id, name, email, role, status`,
      [id, name, email.toLowerCase(), passwordHash]
    );

    const user = insertUser.rows[0];

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), user.id, 'User Registered', 'users', user.id, `User ${user.email} signed up.`]
    );

    // Sign token
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    const response = NextResponse.json({ user, message: 'Signup successful' }, { status: 201 });
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Signup API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
