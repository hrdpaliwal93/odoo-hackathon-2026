# AssetFlow - Enterprise Asset & Resource Management System

AssetFlow is a centralized, role-based ERP platform designed to track, allocate, and maintain physical assets and shared resources for organizations (offices, schools, hospitals, factories, etc.). It replaces manual spreadsheets with structured asset lifecycles, booking overlap checks, maintenance workflows, and scheduled audit checks.

---

## 🚀 Tech Stack

- **Core**: React (Next.js App Router) & TypeScript
- **Database**: PostgreSQL (integrated natively using `pg` driver)
- **Styling**: Premium Vanilla CSS (custom glassmorphism variables, dark mode indicators)
- **Authentication**: JWT Cookies

---

## 🛠️ Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js** installed on your machine.

### 2. Configure Environment Variables
Create or open the `.env` file in the root directory:
```ini
DATABASE_URL="your-postgresql-connection-string"
JWT_SECRET="secret-key-123"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
*(Supports local PostgreSQL or cloud databases like Neon DB).*

### 3. Install Dependencies
Run the following command in the project root:
```bash
npm install
```

### 4. Running the Dev Server
Launch the local development environment:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🗄️ Database Auto-Migrations Flow

We do **not** use manual migrations. The project utilizes a dynamic auto-migration script inside `src/lib/db.ts`:
1. On server startup, the client checks if the database is blank.
2. If tables are missing, it reads the DDL commands from `schema.sql` and executes them directly.
3. It seeds a default administrator: `admin@assetflow.com` / `admin123`.

---

## 🔄 User Roles & Workflows

### 🔑 Role-Based Access Controls (RBAC)

1. **Admin**
   - Setup departments & parent hierarchies.
   - Configure asset categories with custom JSON schemas (e.g. warranty period).
   - Promote employees to Department Heads or Asset Managers.
   - Run audit cycle setups.

2. **Asset Manager**
   - Registers new assets (enters system as *Available*).
   - Allocates assets to employees/departments.
   - Approves returns, condition notes, transfers, and maintenance requests.
   - Resolves audit cycle discrepancies.

3. **Department Head**
   - Reviews department-allocated assets.
   - Approves asset transfers or allocations within their department.
   - Reserves shared resources on behalf of department members.

4. **Employee**
   - Views assets allocated to them.
   - Books shared resources (rooms, vehicles, projectors).
   - Raises maintenance tickets for broken items.
   - Requests returns or transfers.

---

## 🔍 Core Data Flows

### 1. Double-Allocation Prevention
When allocating an asset:
- The system checks if `status == 'Available'`.
- If another user holds it, the allocation is rejected with a **409 Conflict** error displaying the current holder's name (e.g., *Held by Priya*).
- An option to **Initiate Transfer** is displayed instead.

### 2. Resource Booking Overlap Check
When reserving a shared resource (room, vehicle, equipment):
- The system runs an interval overlap query:
  $$\text{Requested Start} < \text{Existing Booking End} \quad \text{AND} \quad \text{Requested End} > \text{Existing Booking Start}$$
- If a conflict is found, the reservation is blocked, displaying the current booking details.

### 3. Maintenance Ticket State locks
- **Step 1**: User raises a ticket (asset enters *Pending* repair).
- **Step 2**: Asset Manager approves (Asset status flips to *Under Maintenance*, locking it from allocations).
- **Step 3**: Repair starts, technician resolves ticket (Asset status reverts to *Available*).

### 4. Scheduled Audits
- **Step 1**: Admin creates an Audit Cycle (filters assets in a department/location).
- **Step 2**: Assigned auditors verify item checklist (options: *Verified*, *Missing*, *Damaged*).
- **Step 3**: Asset Manager closes cycle. Confirming an item is *Missing* updates its status to **Lost** and compiles a discrepancy report log.

---

## 🧪 Hackathon Demo Sandbox Seeding

On the login page, you will see a **"Reset & Seed Demo Data"** button. Clicking this executes a mock seeder (`/api/admin/seed`) which truncates all tables and seeds:
- **Departments**: Engineering (Head: Priya), Design, Operations.
- **Categories**: Electronics, Furniture, Vehicles.
- **Assets**: Seeded laptops (some allocated, some overdue, some available).
- **Resources**: Conference Room Alpha, Tesla Model Y.
- **Seeded Accounts** (all passwords are `password123`):
  - Admin: `admin@assetflow.com`
  - Asset Manager: `sarah@assetflow.com`
  - Dept Head: `priya@assetflow.com`
  - Employee: `raj@assetflow.com`
