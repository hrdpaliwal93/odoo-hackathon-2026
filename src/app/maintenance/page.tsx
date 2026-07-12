'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

interface MaintenanceTicket {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  description: string;
  priority: string;
  status: string;
  photoUrl: string | null;
  assignedTechnician: string | null;
  resolutionNotes: string | null;
  reportedByName: string;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string;
  assetTag: string;
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Request Form
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');

  // Technician Assignment Modal
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState('');

  // Resolve Ticket Modal
  const [resolveTicketId, setResolveTicketId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTicketsAndAssets = async () => {
    try {
      const tRes = await fetch('/api/maintenance');
      if (tRes.ok) {
        const tData = await tRes.json();
        setTickets(tData.maintenance);
      }

      const aRes = await fetch('/api/assets');
      if (aRes.ok) {
        const aData = await aRes.json();
        setAssets(aData.assets);
      }
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    }
  };

  useEffect(() => {
    fetchTicketsAndAssets();
  }, []);

  const handleRaiseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAssetId,
          description,
          priority
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to submit request');
        return;
      }

      setSuccess('Maintenance request submitted successfully! Awaiting Approval.');
      setSelectedAssetId('');
      setDescription('');
      setPriority('Medium');
      fetchTicketsAndAssets();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleUpdateStatus = async (requestId: string, status: string) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Update failed');
        return;
      }
      setSuccess(`Ticket status updated to ${status}`);
      fetchTicketsAndAssets();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleAssignTechnicianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicketId) return;

    try {
      const response = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: activeTicketId,
          status: 'Technician Assigned',
          assignedTechnician: technicianName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Assignment failed');
        return;
      }

      setSuccess('Technician assigned successfully');
      setActiveTicketId(null);
      setTechnicianName('');
      fetchTicketsAndAssets();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTicketId) return;

    try {
      const response = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: resolveTicketId,
          status: 'Resolved',
          resolutionNotes
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Resolution failed');
        return;
      }

      setSuccess('Ticket resolved and asset is set back to Available');
      setResolveTicketId(null);
      setResolutionNotes('');
      fetchTicketsAndAssets();
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Maintenance Tickets</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Report physical asset defects, assign maintenance technicians, and log resolutions.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px', alignItems: 'start' }}>
        {/* Raise Request Form (All users can access) */}
        <div className="glass-card">
          <h3>Report Issue</h3>
          <form onSubmit={handleRaiseRequest} style={{ marginTop: '20px' }}>
            <div className="form-group">
              <label className="form-label">Asset</label>
              <select
                className="form-control"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                required
              >
                <option value="">-- Select Asset --</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.assetTag} - {asset.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Issue Details</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Describe the issue you encountered..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Submit Request
            </button>
          </form>
        </div>

        {/* Tickets Boards */}
        <div className="glass-card">
          <h3>Maintenance Boards</h3>
          
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Description</th>
                  <th>Reporter</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Technician</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.assetTag} - {t.assetName}</td>
                    <td>{t.description}</td>
                    <td>{t.reportedByName}</td>
                    <td>
                      <span className={`badge badge-priority-${t.priority.toLowerCase()}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        t.status === 'Resolved' 
                          ? 'badge-available' 
                          : t.status === 'Pending' 
                            ? 'badge-reserved' 
                            : 'badge-maintenance'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.assignedTechnician || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td>
                      {/* Role Actions */}
                      {['Admin', 'AssetManager'].includes(user?.role || '') && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {t.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(t.id, 'Approved')}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(t.id, 'Rejected')}
                                className="btn btn-danger"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {t.status === 'Approved' && (
                            <button
                              onClick={() => {
                                setActiveTicketId(t.id);
                                setTechnicianName('');
                              }}
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Assign Tech
                            </button>
                          )}
                          {['Approved', 'Technician Assigned', 'In Progress'].includes(t.status) && (
                            <>
                              {t.status === 'Technician Assigned' && (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'In Progress')}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                >
                                  Start Repair
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setResolveTicketId(t.id);
                                  setResolutionNotes('');
                                }}
                                className="btn btn-ghost"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                Resolve
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No maintenance tickets registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Technician Assignment Modal */}
      {activeTicketId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Assign Maintenance Technician</h3>
            <form onSubmit={handleAssignTechnicianSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Technician Name / Partner Agency</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe (Hardware Expert)"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Assignment
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTicketId(null)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolveTicketId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Complete Maintenance Repair</h3>
            <form onSubmit={handleResolveSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Resolution Summary / Actions Taken</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="e.g. Replaced motherboard, tested for boot functionality. All clear."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Resolve Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setResolveTicketId(null)}
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
