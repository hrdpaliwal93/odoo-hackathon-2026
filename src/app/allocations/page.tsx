'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

interface Allocation {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  userName: string | null;
  userEmail: string | null;
  departmentName: string | null;
  allocatedAt: string;
  expectedReturnDate: string | null;
  status: string;
}

interface TransferRequest {
  id: string;
  assetTag: string;
  assetName: string;
  sourceUserName: string;
  targetUserName: string;
  departmentName: string | null;
  status: string;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string;
  assetTag: string;
  status: string;
}

interface UserDirectory {
  id: string;
  name: string;
  email: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AllocationsPage() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<UserDirectory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filter
  const [allocFilter, setAllocFilter] = useState<'active' | 'overdue' | 'returned'>('active');

  // Allocation Form
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [allocationTarget, setAllocationTarget] = useState<'user' | 'department'>('user');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  // Return Form Modal
  const [returnAllocationId, setReturnAllocationId] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnCondition, setReturnCondition] = useState('Good');

  // Transfer Request Form Modal
  const [transferAssetId, setTransferAssetId] = useState<string | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferHolderName, setTransferHolderName] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAllocationsAndTransfers = async () => {
    try {
      const aRes = await fetch(`/api/allocations?filter=${allocFilter}`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAllocations(aData.allocations);
      }

      const tRes = await fetch('/api/transfers');
      if (tRes.ok) {
        const tData = await tRes.json();
        setTransfers(tData.transfers);
      }
    } catch (err) {
      console.error('Error fetching allocations:', err);
    }
  };

  const fetchSupportingData = async () => {
    try {
      const assetRes = await fetch('/api/assets');
      if (assetRes.ok) {
        const data = await assetRes.json();
        setAssets(data.assets);
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
      console.error('Error fetching supporting data:', err);
    }
  };

  useEffect(() => {
    fetchSupportingData();
  }, []);

  useEffect(() => {
    fetchAllocationsAndTransfers();
  }, [allocFilter]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAssetId,
          userId: allocationTarget === 'user' ? targetUserId : null,
          departmentId: allocationTarget === 'department' ? targetDeptId : null,
          expectedReturnDate: expectedReturnDate || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Double allocation conflict! Open Transfer Modal option
          setTransferAssetId(data.assetId);
          setTransferHolderName(data.holderName);
          setError(`Allocation Conflict: Currently held by ${data.holderName}. Click 'Request Transfer' if you'd like to initiate transfer request.`);
        } else {
          setError(data.error || 'Allocation failed');
        }
        return;
      }

      setSuccess('Asset allocated successfully');
      setSelectedAssetId('');
      setTargetUserId('');
      setTargetDeptId('');
      setExpectedReturnDate('');
      fetchAllocationsAndTransfers();
      fetchSupportingData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/allocations/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocationId: returnAllocationId,
          checkInNotes: returnNotes,
          condition: returnCondition
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Return check-in failed');
        return;
      }

      setSuccess('Asset returned and set back to Available');
      setReturnAllocationId(null);
      setReturnNotes('');
      setReturnCondition('Good');
      fetchAllocationsAndTransfers();
      fetchSupportingData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleTransferRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: transferAssetId,
          targetUserId: transferTargetUserId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Transfer request failed');
        return;
      }

      setSuccess('Transfer request submitted successfully. Awaiting Manager Approval.');
      setTransferAssetId(null);
      setTransferTargetUserId('');
      fetchAllocationsAndTransfers();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleProcessTransfer = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/transfers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to process transfer request');
        return;
      }

      setSuccess(`Transfer request ${status.toLowerCase()} successfully`);
      fetchAllocationsAndTransfers();
      fetchSupportingData();
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Allocations & Transfers</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Assign assets, request transfers, check in returns, and prevent double allocation.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px', alignItems: 'start' }}>
        {/* Allocate Asset Form (Admin / Manager only) */}
        {['Admin', 'AssetManager'].includes(user?.role || '') && (
          <div className="glass-card">
            <h3>Allocate Asset</h3>
            <form onSubmit={handleAllocate} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Asset to Allocate</label>
                <select
                  className="form-control"
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Asset --</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} - {asset.name} ({asset.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Allocation Target</label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="radio"
                      name="target"
                      checked={allocationTarget === 'user'}
                      onChange={() => setAllocationTarget('user')}
                      style={{ marginRight: '6px' }}
                    />
                    Employee
                  </label>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="radio"
                      name="target"
                      checked={allocationTarget === 'department'}
                      onChange={() => setAllocationTarget('department')}
                      style={{ marginRight: '6px' }}
                    />
                    Department
                  </label>
                </div>
              </div>

              {allocationTarget === 'user' ? (
                <div className="form-group">
                  <label className="form-label">Target Employee</label>
                  <select
                    className="form-control"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Target Department</label>
                  <select
                    className="form-control"
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Expected Return Date (Optional)</label>
                <input
                  type="date"
                  className="form-control"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Confirm Allocation
              </button>
            </form>

            {/* Quick Link to Transfer request if there's conflict */}
            {transferAssetId && (
              <button
                onClick={() => {
                  setTransferTargetUserId(allocationTarget === 'user' ? targetUserId : '');
                }}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '12px' }}
              >
                Initiate Transfer Request from {transferHolderName}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', gridColumn: ['Admin', 'AssetManager'].includes(user?.role || '') ? 'auto' : 'span 2' }}>
          {/* Active Allocations List */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Allocations Feed</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setAllocFilter('active')}
                  className={`btn ${allocFilter === 'active' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  Active
                </button>
                <button
                  onClick={() => setAllocFilter('overdue')}
                  className={`btn ${allocFilter === 'overdue' ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  Overdue
                </button>
                <button
                  onClick={() => setAllocFilter('returned')}
                  className={`btn ${allocFilter === 'returned' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  Returned
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset Name</th>
                    <th>Holder / Department</th>
                    <th>Allocated At</th>
                    <th>Expected Return</th>
                    <th>Return Status</th>
                    {['Admin', 'AssetManager'].includes(user?.role || '') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => (
                    <tr key={alloc.id}>
                      <td style={{ fontWeight: 600 }}>{alloc.assetTag}</td>
                      <td>{alloc.assetName}</td>
                      <td>{alloc.userName || alloc.departmentName}</td>
                      <td>{new Date(alloc.allocatedAt).toLocaleDateString()}</td>
                      <td>
                        {alloc.expectedReturnDate ? (
                          new Date(alloc.expectedReturnDate).toLocaleDateString()
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          alloc.status === 'Returned' 
                            ? 'badge-available' 
                            : alloc.expectedReturnDate && new Date(alloc.expectedReturnDate) < new Date() 
                              ? 'badge-maintenance' 
                              : 'badge-allocated'
                        }`}>
                          {alloc.status}
                        </span>
                      </td>
                      {['Admin', 'AssetManager'].includes(user?.role || '') && (
                        <td>
                          {alloc.status !== 'Returned' && (
                            <button
                              onClick={() => setReturnAllocationId(alloc.id)}
                              className="btn btn-ghost"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Check-In / Return
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {allocations.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No allocations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transfer Requests Board */}
          <div className="glass-card">
            <h3>Transfer Approvals Board</h3>
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>From</th>
                    <th>To Target</th>
                    <th>Status</th>
                    <th>Submitted At</th>
                    {['Admin', 'AssetManager', 'DepartmentHead'].includes(user?.role || '') && <th>Approval Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600 }}>{req.assetTag} - {req.assetName}</td>
                      <td>{req.sourceUserName}</td>
                      <td>{req.targetUserName}</td>
                      <td>
                        <span className={`badge ${
                          req.status === 'Approved' 
                            ? 'badge-available' 
                            : req.status === 'Rejected' 
                              ? 'badge-maintenance' 
                              : 'badge-reserved'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                      {['Admin', 'AssetManager', 'DepartmentHead'].includes(user?.role || '') && (
                        <td>
                          {req.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleProcessTransfer(req.id, 'Approved')}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleProcessTransfer(req.id, 'Rejected')}
                                className="btn btn-danger"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No pending transfer requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Return Assets Modal Form */}
      {returnAllocationId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Asset Return Checklist</h3>
            <form onSubmit={handleReturnSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Current Condition on Check-In</label>
                <select
                  className="form-control"
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Check-In Notes / Discrepancies</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Scratches on lid, charger returned."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Return Check-In
                </button>
                <button
                  type="button"
                  onClick={() => setReturnAllocationId(null)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Request Modal Form */}
      {transferAssetId && !returnAllocationId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Request Asset Transfer</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Create a request to transfer this asset from {transferHolderName}.
            </p>
            <form onSubmit={handleTransferRequestSubmit}>
              <div className="form-group">
                <label className="form-label">Transfer Target Employee</label>
                <select
                  className="form-control"
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setTransferAssetId(null)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
