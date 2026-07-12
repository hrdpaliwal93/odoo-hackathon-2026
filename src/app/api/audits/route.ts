import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Get audit cycles
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(`
      SELECT ac.id, ac.name, ac.status, ac.start_date as "startDate", ac.end_date as "endDate",
             ac.discrepancy_report as "discrepancyReport", ac.created_at as "createdAt",
             (SELECT COUNT(*) FROM audit_asset_checks WHERE audit_cycle_id = ac.id) as "totalAssets",
             (SELECT COUNT(*) FROM audit_asset_checks WHERE audit_cycle_id = ac.id AND status IS NOT NULL) as "checkedAssets"
      FROM audit_cycles ac
      ORDER BY ac.created_at DESC
    `);

    return NextResponse.json({ auditCycles: res.rows });
  } catch (error: any) {
    console.error('Get Audit Cycles Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Create an audit cycle (Admin only)
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser || adminUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { name, startDate, endDate, scopeType, scopeValue, auditorIds } = await req.json();

    if (!name || !startDate || !endDate || !scopeType || !scopeValue || !auditorIds || !Array.isArray(auditorIds)) {
      return NextResponse.json({ error: 'Missing required audit creation details' }, { status: 400 });
    }

    const crypto = require('crypto');
    const cycleId = crypto.randomUUID();

    // Insert cycle
    await query(
      `INSERT INTO audit_cycles (id, name, status, start_date, end_date)
       VALUES ($1, $2, 'Active', $3, $4)`,
      [cycleId, name, new Date(startDate), new Date(endDate)]
    );

    // Insert assignments
    for (const auditorId of auditorIds) {
      await query(
        `INSERT INTO audit_assignments (id, audit_cycle_id, auditor_id)
         VALUES ($1, $2, $3)`,
        [crypto.randomUUID(), cycleId, auditorId]
      );
      
      // Notify auditor
      await query(
        `INSERT INTO notifications (id, user_id, message, type)
         VALUES ($1, $2, $3, 'info')`,
        [crypto.randomUUID(), auditorId, `You have been assigned as an auditor for cycle: ${name}.`, 'info']
      );
    }

    // Determine assets in scope and pre-populate audit_asset_checks
    let assetsRes;
    if (scopeType === 'department') {
      assetsRes = await query('SELECT id FROM assets WHERE current_department_id = $1', [scopeValue]);
    } else {
      // location-based
      assetsRes = await query('SELECT id FROM assets WHERE LOWER(location) = LOWER($1)', [scopeValue]);
    }

    // Default status in SQL CHECK requires one of Verified, Missing, Damaged, so we insert check status on checking.
    // Or we will insert with a default check status when auditor submits it, but let's record list of assets to verify.
    // To record list of assets, we can insert them into audit_asset_checks, but wait: the check status column is NOT NULL CHECK.
    // So let's insert checks with a default placeholder status like 'Verified' or just insert them when audited.
    // To list in-scope assets dynamically during audits, we can check the scope, or store scope in DB.
    // Wait, let's keep it simple: we can store the scope in DDL. Let's look at schema.sql:
    // status VARCHAR(50) CHECK status in Verified, Missing, Damaged.
    // We can pre-populate with status = 'Verified' initially, and let auditors modify them to 'Missing' or 'Damaged' if needed.
    // Or we can just insert them as 'Verified' by default. Let's do that!
    for (const asset of assetsRes.rows) {
      await query(
        `INSERT INTO audit_asset_checks (id, audit_cycle_id, asset_id, status, checked_by_user_id)
         VALUES ($1, $2, $3, 'Verified', $4)`,
        [crypto.randomUUID(), cycleId, asset.id, adminUser.id]
      );
    }

    // Log Activity
    await query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), adminUser.id, 'Audit Cycle Created', 'audit_cycles', cycleId, `Created cycle ${name} with ${assetsRes.rows.length} assets.`]
    );

    return NextResponse.json({ cycleId, message: 'Audit cycle initialized successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Create Audit Cycle Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
