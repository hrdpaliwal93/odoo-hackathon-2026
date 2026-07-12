'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface AssetDetail {
  id: string;
  name: string;
  assetTag: string;
  serialNumber: string;
  acquisitionDate: string;
  acquisitionCost: number;
  condition: string;
  location: string;
  status: string;
  isSharedBookable: boolean;
  categoryName: string;
  departmentName: string | null;
  holderName: string | null;
}

interface AllocationLog {
  id: string;
  allocatedAt: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  checkInNotes: string | null;
  status: string;
  userName: string | null;
  userEmail: string | null;
  departmentName: string | null;
}

interface MaintenanceLog {
  id: string;
  description: string;
  priority: string;
  status: string;
  photoUrl: string | null;
  assignedTechnician: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export default function AssetHistoryPage() {
  const params = useParams();
  const id = params.id as string;

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [allocations, setAllocations] = useState<AllocationLog[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/assets/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAsset(data.asset);
          setAllocations(data.allocations);
          setMaintenance(data.maintenance);
        }
      } catch (err) {
        console.error('Error fetching asset history:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchHistory();
  }, [id]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'available') return <span className="badge badge-available">Available</span>;
    if (s === 'allocated') return <span className="badge badge-allocated">Allocated</span>;
    if (s === 'under maintenance') return <span className="badge badge-maintenance">Maintenance</span>;
    if (s === 'lost') return <span className="badge badge-lost">Lost</span>;
    if (s === 'retired') return <span className="badge badge-retired">Retired</span>;
    return <span className="badge badge-disposed">{status}</span>;
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/assets" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            ← Back to Directory
          </Link>
          {asset && (
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
              Asset Details: <span className="gradient-text">{asset.name}</span>
            </h1>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading asset history...</p>
      ) : !asset ? (
        <div className="alert alert-error">Asset record not found.</div>
      ) : (
        <>
          {/* Main Info Card */}
          <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Asset Tag</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>{asset.assetTag}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Serial Number</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>{asset.serialNumber}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Category</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>{asset.categoryName}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status</span>
              <div style={{ marginTop: '6px' }}>{getStatusBadge(asset.status)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Condition</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>{asset.condition}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Acquisition Cost</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>${asset.acquisitionCost.toFixed(2)}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Acquisition Date</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>
                {new Date(asset.acquisitionDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Location</span>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '4px' }}>{asset.location}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Allocation history list */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '20px' }}>Allocation History</h3>
              {allocations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No allocation records exist for this asset.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {allocations.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {log.userName || log.departmentName}
                        </span>
                        <span className={`badge ${log.status === 'Returned' ? 'badge-available' : 'badge-allocated'}`}>
                          {log.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Allocated:</strong> {new Date(log.allocatedAt).toLocaleString()}
                      </p>
                      {log.expectedReturnDate && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Expected Return:</strong> {new Date(log.expectedReturnDate).toLocaleDateString()}
                        </p>
                      )}
                      {log.returnedAt && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Returned:</strong> {new Date(log.returnedAt).toLocaleString()}
                        </p>
                      )}
                      {log.checkInNotes && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                          Check-in Notes: "{log.checkInNotes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance history list */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '20px' }}>Maintenance Log</h3>
              {maintenance.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No maintenance requests exist for this asset.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {maintenance.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.description}</span>
                        <span className={`badge ${log.status === 'Resolved' ? 'badge-available' : 'badge-maintenance'}`}>
                          {log.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Reported:</strong> {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.assignedTechnician && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Technician:</strong> {log.assignedTechnician}
                        </p>
                      )}
                      {log.resolutionNotes && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                          Resolution Notes: "{log.resolutionNotes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
