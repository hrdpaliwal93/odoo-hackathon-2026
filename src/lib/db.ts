import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Retrieve database URL from env variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL is not set. Database features will fail.");
}

// Create a connection pool to PostgreSQL
export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

let initialized = false;

// Automatically execute schema DDL if needed on bootstrap
export async function initializeDatabase() {
  if (initialized) return;

  try {
    const client = await pool.connect();
    try {
      // Check if table 'users' exists
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);
      
      const exists = res.rows[0].exists;
      if (!exists) {
        console.log("Database table 'users' not found. Executing schema.sql migration...");
        // Read DDL file
        const schemaPath = path.join(process.cwd(), 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        // Execute DDL
        await client.query(schemaSql);
        console.log("Database schema migrated successfully.");
        
        // Seed an initial Admin user if table is empty
        const userRes = await client.query("SELECT COUNT(*) FROM users");
        const userCount = parseInt(userRes.rows[0].count, 10);
        if (userCount === 0) {
          // Password hash for 'admin123' using bcrypt-like hash (or standard placeholder)
          // We can use bcryptjs, let's import it dynamically to avoid compile/runtime delays
          const bcrypt = require('bcryptjs');
          const passwordHash = await bcrypt.hash('admin123', 10);
          const adminId = 'admin-uuid-0000-0000-000000000000';
          
          await client.query(`
            INSERT INTO users (id, name, email, password_hash, role, status)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [adminId, 'Admin User', 'admin@assetflow.com', passwordHash, 'Admin', 'Active']);
          console.log("Seeded initial Admin user: admin@assetflow.com / admin123");
        }
      } else {
        console.log("Database tables verified. Schema already exists.");
      }
      initialized = true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
  }
}

// Helper to run query easily
export async function query(text: string, params?: any[]) {
  // Ensure DB is initialized before executing query
  await initializeDatabase();
  return pool.query(text, params);
}
