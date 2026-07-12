'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Department {
  id: string;
  name: string;
  headId: string | null;
  headName: string | null;
  parentDepartmentId: string | null;
  parentName: string | null;
  status: 'Active' | 'Inactive';
  employeeCount: string;
}

interface Category {
  id: string;
  name: string;
  customFields: any;
  assetCount: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'AssetManager' | 'DepartmentHead' | 'Employee';
  departmentId: string | null;
  departmentName: string | null;
  status: 'Active' | 'Inactive';
}

export default function OrgSetup() {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [deptName, setDeptName] = useState('');
  const [deptHeadId, setDeptHeadId] = useState('');
  const [deptParentId, setDeptParentId] = useState('');
  const [deptStatus, setDeptStatus] = useState<'Active' | 'Inactive'>('Active');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  const [catName, setCatName] = useState('');
  const [catCustomFieldName, setCatCustomFieldName] = useState('');
  const [catCustomFields, setCatCustomFields] = useState<Record<string, string>>({});
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const dRes = await fetch('/api/admin/departments');
      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(dData.departments);
      }

      const cRes = await fetch('/api/admin/categories');
      if (cRes.ok) {
        const cData = await cRes.json();
        setCategories(cData.categories);
      }

      const eRes = await fetch('/api/admin/employees');
      if (eRes.ok) {
        const eData = await eRes.json();
        setEmployees(eData.employees);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const url = '/api/admin/departments';
    const method = editingDeptId ? 'PUT' : 'POST';
    const body = editingDeptId
      ? { id: editingDeptId, name: deptName, headId: deptHeadId, parentDepartmentId: deptParentId, status: deptStatus }
      : { name: deptName, headId: deptHeadId, parentDepartmentId: deptParentId };

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Operation failed');
        return;
      }

      setSuccess(data.message);
      // Reset forms
      setDeptName('');
      setDeptHeadId('');
      setDeptParentId('');
      setDeptStatus('Active');
      setEditingDeptId(null);
      fetchData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleCreateOrEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const url = '/api/admin/categories';
    const method = editingCatId ? 'PUT' : 'POST';
    const body = editingCatId
      ? { id: editingCatId, name: catName, customFields: catCustomFields }
      : { name: catName, customFields: catCustomFields };

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Operation failed');
        return;
      }

      setSuccess(data.message);
      setCatName('');
      setCatCustomFields({});
      setEditingCatId(null);
      fetchData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handlePromoteEmployee = async (employeeId: string, role: string, departmentId: string | null, status: string) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, role, departmentId, status })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Promotion failed');
        return;
      }
      setSuccess(data.message);
      fetchData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Organization Setup</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Maintain master departments, categories, and manage roles in the directory.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs-header">
        <button
          onClick={() => setActiveTab('departments')}
          className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
        >
          Department Management
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
        >
          Asset Categories
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
        >
          Employee Directory
        </button>
      </div>

      {/* Tab A - Departments */}
      {activeTab === 'departments' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
          <div className="glass-card">
            <h3>{editingDeptId ? 'Edit Department' : 'Create Department'}</h3>
            <form onSubmit={handleCreateOrEditDept} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Finance"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign Department Head (Optional)</label>
                <select
                  className="form-control"
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Parent Department (Optional)</label>
                <select
                  className="form-control"
                  value={deptParentId}
                  onChange={(e) => setDeptParentId(e.target.value)}
                >
                  <option value="">-- None --</option>
                  {departments
                    .filter((d) => d.id !== editingDeptId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>

              {editingDeptId && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={deptStatus}
                    onChange={(e) => setDeptStatus(e.target.value as 'Active' | 'Inactive')}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingDeptId ? 'Save Changes' : 'Create'}
                </button>
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDeptId(null);
                      setDeptName('');
                      setDeptHeadId('');
                      setDeptParentId('');
                      setDeptStatus('Active');
                    }}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-card">
            <h3>Departments List</h3>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Head</th>
                  <th>Hierarchy Parent</th>
                  <th>Employees Count</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td style={{ fontWeight: 600 }}>{dept.name}</td>
                    <td>{dept.headName || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td>{dept.parentName || <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                    <td>{dept.employeeCount}</td>
                    <td>
                      <span className={`badge ${dept.status === 'Active' ? 'badge-available' : 'badge-maintenance'}`}>
                        {dept.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setDeptName(dept.name);
                          setDeptHeadId(dept.headId || '');
                          setDeptParentId(dept.parentDepartmentId || '');
                          setDeptStatus(dept.status);
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab B - Asset Categories */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
          <div className="glass-card">
            <h3>{editingCatId ? 'Edit Category' : 'Create Asset Category'}</h3>
            <form onSubmit={handleCreateOrEditCategory} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Vehicles"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Add Category-Specific Meta Fields</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Field name (e.g. warranty_period)"
                    value={catCustomFieldName}
                    onChange={(e) => setCatCustomFieldName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (catCustomFieldName.trim()) {
                        setCatCustomFields({ ...catCustomFields, [catCustomFieldName.trim()]: 'text' });
                        setCatCustomFieldName('');
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0 16px' }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ marginTop: '12px' }}>
                  {Object.keys(catCustomFields).map((f) => (
                    <span
                      key={f}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        marginRight: '8px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {f}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          const copy = { ...catCustomFields };
                          delete copy[f];
                          setCatCustomFields(copy);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                {editingCatId ? 'Save Changes' : 'Create Category'}
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h3>Asset Categories</h3>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Asset Schema Fields</th>
                  <th>Asset Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 600 }}>{cat.name}</td>
                    <td>
                      {cat.customFields ? (
                        Object.keys(cat.customFields).join(', ')
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>
                    <td>{cat.assetCount}</td>
                    <td>
                      <button
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatName(cat.name);
                          setCatCustomFields(cat.customFields || {});
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab C - Employee Directory */}
      {activeTab === 'employees' && (
        <div className="glass-card">
          <h3>Employee Directory & Promotion Board</h3>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Current Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.departmentName || <span style={{ color: 'var(--text-muted)' }}>Bench</span>}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: emp.role === 'Admin' ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${emp.status === 'Active' ? 'badge-available' : 'badge-maintenance'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={emp.role}
                        onChange={(e) => handlePromoteEmployee(emp.id, e.target.value, emp.departmentId, emp.status)}
                        className="form-control"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <option value="Employee">Employee</option>
                        <option value="AssetManager">Asset Manager</option>
                        <option value="DepartmentHead">Department Head</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <button
                        onClick={() =>
                          handlePromoteEmployee(emp.id, emp.role, emp.departmentId, emp.status === 'Active' ? 'Inactive' : 'Active')
                        }
                        className="btn btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
