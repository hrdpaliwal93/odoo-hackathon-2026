'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

interface AuditCycle {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  discrepancyReport: string | null;
  totalAssets: number;
  checkedAssets: number;
}

interface AuditCheck {
  id: string;
  assetId: string;
  status: 'Verified' | 'Missing' | 'Damaged';
  checkedAt: string;
  assetName: string;
  assetTag: string;
  serialNumber: string;
  assetCondition: string;
  assetStatus: string;
  checkedByName: string;
}

interface UserDirectory {
  id: string;
  name: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AuditsPage() {
  const { user } = useAuth();

  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [employees, setEmployees] = useState<UserDirectory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Selection
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [checks, setChecks] = useState<AuditCheck[]>([]);

  // Audit Creation Form
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scopeType, setScopeType] = useState<'department' | 'location'>('department');
  const [scopeValue, setScopeValue] = useState('');
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCyclesAndData = async () => {
    try {
      const response = await fetch('/api/audits');
      if (response.ok) {
        const data = await response.json();
        setCycles(data.auditCycles);
      }

      const empRes = await fetch('/api/admin/employees');
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees);
      }

      const deptRes = await fetch('/api/admin/departments');
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.departments);
      }
    } catch (err) {
      console.error('Error fetching audit data:', err);
    }
  };

  const fetchChecks = async (cycleId: string) => {
    try {
      const response = await fetch(`/api/audits/${cycleId}/checks`);
      if (response.ok) {
        const data = await response.json();
        setChecks(data.checks);
      }
    } catch (err) {
      console.error('Error fetching checks:', err);
    }
  };

  useEffect(() => {
    fetchCyclesAndData();
  }, []);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          scopeType,
          scopeValue,
          auditorIds: selectedAuditors
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to initialize cycle');
        return;
      }

      setSuccess('Audit cycle created successfully!');
      setName('');
      setStartDate('');
      setEndDate('');
      setScopeValue('');
      setSelectedAuditors([]);
      fetchCyclesAndData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleUpdateCheck = async (checkId: string, status: 'Verified' | 'Missing' | 'Damaged') => {
    if (!selectedCycleId) return;
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/audits/${selectedCycleId}/checks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId, status })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to update check');
        return;
      }

      setSuccess('Asset check logged');
      fetchChecks(selectedCycleId);
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleCloseCycle = async () => {
    if (!selectedCycleId) return;
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/audits/${selectedCycleId}/close`, {
        method: 'POST'
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to close cycle');
        return;
      }

      setSuccess('Audit cycle closed. Discrepancy report generated. Confirmed missing items marked Lost.');
      setSelectedCycleId(null);
      fetchCyclesAndData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Scheduled Asset Audits</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Schedule audit verification cycles, assign auditors, and auto-flag discrepancies.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {selectedCycleId ? (
        /* Audit Verification Checklist Mode */
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <button
                onClick={() => setSelectedCycleId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                ← Back to Cycles List
              </button>
              <h2 style={{ marginTop: '8px' }}>Auditing: {cycles.find((c) => c.id === selectedCycleId)?.name}</h2>
            </div>
            {['Admin', 'AssetManager'].includes(user?.role || '') && (
              <button onClick={handleCloseCycle} className="btn btn-danger">
                Lock & Close Cycle
              </button>
            )}
          </div>

          <table className="custom-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Serial Number</th>
                <th>Assigned Condition</th>
                <th>Current Status</th>
                <th>Auditor Checklist</th>
                <th>Checked By</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id}>
                  <td style={{ fontWeight: 600 }}>{check.assetTag}</td>
                  <td>{check.assetName}</td>
                  <td>{check.serialNumber}</td>
                  <td>{check.assetCondition}</td>
                  <td>{check.assetStatus}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleUpdateCheck(check.id, 'Verified')}
                        className={`btn ${check.status === 'Verified' ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        Verified
                      </button>
                      <button
                        onClick={() => handleUpdateCheck(check.id, 'Missing')}
                        className={`btn ${check.status === 'Missing' ? 'btn-danger' : 'btn-ghost'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        Missing
                      </button>
                      <button
                        onClick={() => handleUpdateCheck(check.id, 'Damaged')}
                        className={`btn ${check.status === 'Damaged' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        Damaged
                      </button>
                    </div>
                  </td>
                  <td>{check.checkedByName} ({new Date(check.checkedAt).toLocaleTimeString()})</td>
                </tr>
              ))}
              {checks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No assets in scope for this audit cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cycles List + Creation Form Mode */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px', alignItems: 'start' }}>
          {/* Create Audit Cycle (Admin only) */}
          {user?.role === 'Admin' && (
            <div className="glass-card">
              <h3>Create Audit Cycle</h3>
              <form onSubmit={handleCreateAudit} style={{ marginTop: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Audit Cycle Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Q3 Electronics Audit"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scope Target</label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeType === 'department'}
                        onChange={() => { setScopeType('department'); setScopeValue(''); }}
                        style={{ marginRight: '6px' }}
                      />
                      Department
                    </label>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeType === 'location'}
                        onChange={() => { setScopeType('location'); setScopeValue(''); }}
                        style={{ marginRight: '6px' }}
                      />
                      Location/Floor
                    </label>
                  </div>
                </div>

                {scopeType === 'department' ? (
                  <div className="form-group">
                    <label className="form-label">Target Department</label>
                    <select
                      className="form-control"
                      value={scopeValue}
                      onChange={(e) => setScopeValue(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Target Location Address/Room</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. HQ Room 401"
                      value={scopeValue}
                      onChange={(e) => setScopeValue(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Assign Auditors (Multi-select)</label>
                  <select
                    multiple
                    className="form-control"
                    style={{ height: '100px' }}
                    value={selectedAuditors}
                    onChange={(e) => {
                      const options = e.target.options;
                      const selected: string[] = [];
                      for (let i = 0; i < options.length; i++) {
                        if (options[i].selected) {
                          selected.push(options[i].value);
                        }
                      }
                      setSelectedAuditors(selected);
                    }}
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Hold Ctrl (or Cmd) to select multiple auditors.
                  </span>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Initialize Audit Cycle
                </button>
              </form>
            </div>
          )}

          {/* Audit Cycles list */}
          <div className="glass-card" style={{ gridColumn: user?.role === 'Admin' ? 'auto' : 'span 2' }}>
            <h3>Audit Cycles</h3>
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Cycle Name</th>
                    <th>Date Range</th>
                    <th>Status</th>
                    <th>Audited Count</th>
                    <th>Discrepancy Report Summary</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge ${
                          c.status === 'Closed' ? 'badge-available' : 'badge-reserved'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td>{c.checkedAssets} / {c.totalAssets}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {c.discrepancyReport || <span style={{ color: 'var(--text-muted)' }}>Cycle Open / No report</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setSelectedCycleId(c.id);
                              fetchChecks(c.id);
                            }}
                            className="btn btn-ghost"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            {c.status === 'Closed' ? 'View Results' : 'Open Checklist'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cycles.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No audit cycles configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
