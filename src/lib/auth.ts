import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'assetflow-super-secret-key-123!';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

// Sign JWT token
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

// Get logged-in user from request
export async function getAuthenticatedUser(req: NextRequest) {
  const token = req.cookies.get('token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    const res = await query(
      'SELECT id, name, email, role, department_id as "departmentId", status FROM users WHERE id = $1',
      [payload.userId]
    );
    if (res.rows.length === 0 || res.rows[0].status === 'Inactive') {
      return null;
    }
    return res.rows[0];
  } catch (error) {
    console.error("Failed to query authenticated user:", error);
    return null;
  }
}
