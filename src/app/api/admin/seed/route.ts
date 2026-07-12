import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const crypto = require('crypto');
    console.log("Seeding mock database...");

    // 1. Truncate tables in correct order
    await query('TRUNCATE activity_logs, notifications, audit_asset_checks, audit_assignments, audit_cycles, maintenance_requests, resource_bookings, resources, transfer_requests, asset_allocations, assets, users, asset_categories, departments CASCADE');

    // 2. Seed Departments
    const deptEngId = crypto.randomUUID();
    const deptDesId = crypto.randomUUID();
    const deptOpsId = crypto.randomUUID();

    await query(`INSERT INTO departments (id, name, status) VALUES ($1, 'Engineering', 'Active')`, [deptEngId]);
    await query(`INSERT INTO departments (id, name, status) VALUES ($1, 'Design', 'Active')`, [deptDesId]);
    await query(`INSERT INTO departments (id, name, status) VALUES ($1, 'Operations', 'Active')`, [deptOpsId]);

    // 3. Seed Users (with hashed passwords)
    const salt = await bcrypt.genSalt(10);
    const commonHash = await bcrypt.hash('password123', salt);

    const adminId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    const headId = crypto.randomUUID();
    const emp1Id = crypto.randomUUID();
    const emp2Id = crypto.randomUUID();

    // Admin
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, status) 
       VALUES ($1, 'Global Admin', 'admin@assetflow.com', $2, 'Admin', 'Active')`,
      [adminId, commonHash]
    );

    // Asset Manager
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, status, department_id) 
       VALUES ($1, 'Sarah Manager', 'sarah@assetflow.com', $2, 'AssetManager', 'Active', $3)`,
      [managerId, commonHash, deptOpsId]
    );

    // Department Head
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, status, department_id) 
       VALUES ($1, 'Priya Patel', 'priya@assetflow.com', $2, 'DepartmentHead', 'Active', $3)`,
      [headId, commonHash, deptEngId]
    );
    // Link head to department
    await query(`UPDATE departments SET head_id = $1 WHERE id = $2`, [headId, deptEngId]);

    // Standard Employees
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, status, department_id) 
       VALUES ($1, 'Raj Kumar', 'raj@assetflow.com', $2, 'Employee', 'Active', $3)`,
      [emp1Id, commonHash, deptEngId]
    );
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, status, department_id) 
       VALUES ($1, 'Emily Chen', 'emily@assetflow.com', $2, 'Employee', 'Active', $3)`,
      [emp2Id, commonHash, deptDesId]
    );

    // 4. Seed Asset Categories
    const catElecId = crypto.randomUUID();
    const catFurnId = crypto.randomUUID();
    const catVehId = crypto.randomUUID();

    await query(
      `INSERT INTO asset_categories (id, name, custom_fields) 
       VALUES ($1, 'Electronics', '{"warranty_months": 24, "manufacturer": "Apple/Dell"}'::jsonb)`,
      [catElecId]
    );
    await query(
      `INSERT INTO asset_categories (id, name, custom_fields) 
       VALUES ($1, 'Furniture', '{"material": "Wood/Mesh", "ergonomic": true}'::jsonb)`,
      [catFurnId]
    );
    await query(
      `INSERT INTO asset_categories (id, name, custom_fields) 
       VALUES ($1, 'Vehicles', '{"fuel_type": "Electric/Gas", "next_service_mileage": 10000}'::jsonb)`,
      [catVehId]
    );

    // 5. Seed Assets
    const asset1Id = crypto.randomUUID();
    const asset2Id = crypto.randomUUID();
    const asset3Id = crypto.randomUUID();
    const asset4Id = crypto.randomUUID();

    // MacBook Pro (Allocated to Priya)
    await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, current_holder_id, current_department_id)
       VALUES ($1, 'MacBook Pro 16', $2, 'AF-0001', 'SN-MBP16-991', '2025-01-15', 2499.00, 'New', 'HQ Room 401', 'Allocated', $3, $4)`,
      [asset1Id, catElecId, headId, deptEngId]
    );
    // Create its allocation record
    await query(
      `INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_at, status)
       VALUES ($1, $2, $3, $4, '2025-01-16 09:00:00', 'Allocated')`,
      [crypto.randomUUID(), asset1Id, headId, deptEngId]
    );

    // Dell UltraSharp Monitor (Available)
    await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status)
       VALUES ($1, 'Dell UltraSharp 32', $2, 'AF-0002', 'SN-DELL32-552', '2025-02-10', 699.00, 'Good', 'HQ Desk 14', 'Available')`,
      [asset2Id, catElecId]
    );

    // Steelcase Ergonomic Chair (Available, Shared Bookable)
    await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_shared_bookable)
       VALUES ($1, 'Steelcase Leap V2', $2, 'AF-0003', 'SN-STCS-234', '2024-06-01', 950.00, 'Good', 'Conference Room A', 'Available', TRUE)`,
      [asset3Id, catFurnId]
    );

    // Ford Transit Van (Under Maintenance)
    await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status)
       VALUES ($1, 'Transit Cargo Van', $2, 'AF-0004', 'SN-FORD-VAN44', '2023-11-20', 35000.00, 'Fair', 'HQ Garage', 'Under Maintenance')`,
      [asset4Id, catVehId]
    );
    // Create maintenance ticket for the van
    const maintenanceId = crypto.randomUUID();
    await query(
      `INSERT INTO maintenance_requests (id, asset_id, reported_by_user_id, description, priority, status, assigned_technician)
       VALUES ($1, $2, $3, 'Oil change and brake pads replacement', 'Medium', 'Approved', 'Bob mechanic')`,
      [maintenanceId, asset4Id, managerId]
    );

    // 6. Seed Shared Resources
    const resRoomId = crypto.randomUUID();
    const resCarId = crypto.randomUUID();

    await query(
      `INSERT INTO resources (id, name, description, category, location)
       VALUES ($1, 'Conference Room Alpha', 'Equipped with video conferencing TV and whiteboard.', 'Room', 'HQ Floor 2')`,
      [resRoomId]
    );
    await query(
      `INSERT INTO resources (id, name, description, category, location)
       VALUES ($1, 'Tesla Model Y (Ops)', 'Company vehicle for client visits.', 'Vehicle', 'HQ Garage Slot 3')`,
      [resCarId]
    );

    // Create a resource booking
    await query(
      `INSERT INTO resource_bookings (id, resource_id, user_id, department_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, '2026-07-12 10:00:00', '2026-07-12 12:00:00', 'Upcoming')`,
      [crypto.randomUUID(), resRoomId, headId, deptEngId]
    );

    // Create overdue allocation for mock testing (expected return in 2025)
    const overdueAssetId = crypto.randomUUID();
    await query(
      `INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, current_holder_id, current_department_id)
       VALUES ($1, 'iPad Air 256GB', $2, 'AF-0005', 'SN-IPAD-AIR-9', '2024-03-01', 599.00, 'Good', 'Remote', 'Allocated', $3, $4)`,
      [overdueAssetId, catElecId, emp1Id, deptEngId]
    );
    await query(
      `INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_at, expected_return_date, status)
       VALUES ($1, $2, $3, $4, '2024-03-05 09:00:00', '2025-03-05 09:00:00', 'Allocated')`,
      [crypto.randomUUID(), overdueAssetId, emp1Id, deptEngId]
    );

    console.log("Database seeded successfully.");
    return NextResponse.json({ message: 'Database reset and seeded successfully' });
  } catch (error: any) {
    console.error('Seed Database Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
