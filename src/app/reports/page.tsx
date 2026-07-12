'use client';

import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

interface TopAsset {
  name: string;
  assetTag: string;
  allocationsCount: string;
}

interface DeptAllocation {
  departmentName: string;
  allocatedCount: string;
}

interface MaintenanceCategory {
  categoryName: string;
  maintenanceCount: string;
}

interface BookingHeatmap {
  hour: number;
  bookingsCount: string;
}

interface NearingRetirement {
  name: string;
  assetTag: string;
  acquisitionDate: string;
  status: string;
  condition: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [topAssets, setTopAssets] = useState<TopAsset[]>([]);
  const [deptAllocations, setDeptAllocations] = useState<DeptAllocation[]>([]);
  const [maintenanceCategory, setMaintenanceCategory] = useState<MaintenanceCategory[]>([]);
  const [bookingHeatmap, setBookingHeatmap] = useState<BookingHeatmap[]>([]);
  const [nearingRetirement, setNearingRetirement] = useState<NearingRetirement[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        if (response.ok) {
          const data = await response.json();
          setTopAssets(data.topAssets);
          setDeptAllocations(data.deptAllocations);
          setMaintenanceCategory(data.maintenanceCategory);
          setBookingHeatmap(data.bookingHeatmap);
          setNearingRetirement(data.nearingRetirement);
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // Helpers to draw bar chart percentages
  const getMaxVal = (arr: any[], key: string) => {
    if (arr.length === 0) return 1;
    return Math.max(...arr.map((item) => parseInt(item[key], 10)));
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Actionable manager dashboard displaying usage, bookings heatmaps and lifecycle statistics.
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics dashboard...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Row 1: Asset Utilization & Department Allocations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Top Assets Card */}
            <div className="glass-card">
              <h3>Asset Utilization Trends (Top Assets)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Assets with the highest historical allocation count.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {topAssets.map((asset) => {
                  const max = getMaxVal(topAssets, 'allocationsCount');
                  const percent = (parseInt(asset.allocationsCount, 10) / max) * 100;
                  return (
                    <div key={asset.assetTag}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                        <span>{asset.name} ({asset.assetTag})</span>
                        <span style={{ fontWeight: 700 }}>{asset.allocationsCount} Allocations</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary-gradient)' }} />
                      </div>
                    </div>
                  );
                })}
                {topAssets.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No allocation logs recorded.</p>}
              </div>
            </div>

            {/* Department-wise Allocations */}
            <div className="glass-card">
              <h3>Department Allocation Summary</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Active allocated physical assets per department.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {deptAllocations.map((dept) => {
                  const max = getMaxVal(deptAllocations, 'allocatedCount');
                  const percent = (parseInt(dept.allocatedCount, 10) / max) * 100;
                  return (
                    <div key={dept.departmentName}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                        <span>{dept.departmentName}</span>
                        <span style={{ fontWeight: 700 }}>{dept.allocatedCount} Assets</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--secondary-gradient)' }} />
                      </div>
                    </div>
                  );
                })}
                {deptAllocations.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active department allocations.</p>}
              </div>
            </div>
          </div>

          {/* Row 2: Booking Heatmap & Maintenance frequency */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
            {/* Booking Heatmap */}
            <div className="glass-card">
              <h3>Resource Booking Heatmap</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Peak windows of hourly resource usage.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '4px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', overflowX: 'auto' }}>
                {Array.from({ length: 24 }).map((_, index) => {
                  const hrData = bookingHeatmap.find((h) => Math.floor(h.hour) === index);
                  const count = hrData ? parseInt(hrData.bookingsCount, 10) : 0;
                  // Color density
                  const opacity = count > 0 ? Math.min(0.2 + (count / 5) * 0.8, 1) : 0.05;
                  const bgColor = count > 0 ? `rgba(99, 102, 241, ${opacity})` : 'rgba(255, 255, 255, 0.02)';
                  const labelColor = count > 0 ? '#ffffff' : 'var(--text-muted)';
                  return (
                    <div
                      key={index}
                      title={`${index}:00 - ${count} bookings`}
                      style={{
                        height: '60px',
                        background: bgColor,
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: count > 0 ? 800 : 400,
                        color: labelColor,
                        minWidth: '24px'
                      }}
                    >
                      <span>{count}</span>
                      <span style={{ fontSize: '0.55rem', opacity: 0.6, marginTop: '4px' }}>{index}h</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Maintenance Category Frequency */}
            <div className="glass-card">
              <h3>Maintenance Frequency by Category</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Repair tickets requested by category.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {maintenanceCategory.map((cat) => {
                  const max = getMaxVal(maintenanceCategory, 'maintenanceCount');
                  const percent = (parseInt(cat.maintenanceCount, 10) / max) * 100;
                  return (
                    <div key={cat.categoryName}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                        <span>{cat.categoryName}</span>
                        <span style={{ fontWeight: 700 }}>{cat.maintenanceCount} Tickets</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                      </div>
                    </div>
                  );
                })}
                {maintenanceCategory.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No maintenance logs recorded.</p>}
              </div>
            </div>
          </div>

          {/* Row 3: Nearing Retirement */}
          <div className="glass-card">
            <h3>Asset Life-Cycle: Nearing Retirement</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Assets acquired over 3 years ago that may need replacement cycles.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset Name</th>
                    <th>Acquisition Date</th>
                    <th>Condition</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nearingRetirement.map((asset) => (
                    <tr key={asset.assetTag}>
                      <td style={{ fontWeight: 600 }}>{asset.assetTag}</td>
                      <td>{asset.name}</td>
                      <td>{new Date(asset.acquisitionDate).toLocaleDateString()}</td>
                      <td>{asset.condition}</td>
                      <td>
                        <span className="badge badge-maintenance">Nearing Limit</span>
                      </td>
                    </tr>
                  ))}
                  {nearingRetirement.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        All assets are within standard operating lifespan.
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
