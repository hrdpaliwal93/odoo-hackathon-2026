'use client';

import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface KPIStats {
  available: number;
  allocated: number;
  maintenance: number;
  activeBookings: number;
  pendingTransfers: number;
  upcomingReturns: number;
  overdueReturns: number;
}

interface OverdueReturn {
  id: string;
  expectedReturnDate: string;
  assetName: string;
  assetTag: string;
  userName: string;
  userEmail: string;
}

interface NotificationItem {
  id: string;
  message: string;
  type: string;
  createdAt: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [overdues, setOverdues] = useState<OverdueReturn[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/dashboard');
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.kpis);
        setOverdues(data.overdueReturns);
      }

      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications);
      }
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <Layout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>
          Welcome back, <span className="gradient-text">{user?.name}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Here is your real-time operational snapshot for today.
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
      ) : (
        <>
          {/* Overdue Alert Banner if any */}
          {stats && stats.overdueReturns > 0 && (
            <div className="alert alert-error" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700 }}>
                  ⚠️ ATTENTION: {stats.overdueReturns} Asset Returns are Overdue!
                </span>
                <span style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                  Please check the Overdue Returns table below to contact respective employees.
                </span>
              </div>
            </div>
          )}

          {/* Quick Actions Panel */}
          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Quick Operations</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {['Admin', 'AssetManager'].includes(user?.role || '') && (
                <Link href="/assets" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  Register Asset
                </Link>
              )}
              <Link href="/bookings" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Book Resource
              </Link>
              <Link href="/maintenance" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                Raise Maintenance Request
              </Link>
            </div>
          </div>

          {/* KPI Grid */}
          {stats && (
            <div className="grid-container" style={{ marginBottom: '32px' }}>
              <div className="glass-card" style={{ borderLeft: '4px solid #14b8a6' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Assets Available
                </span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#14b8a6' }}>
                  {stats.available}
                </h2>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #6366f1' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Assets Allocated
                </span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>
                  {stats.allocated}
                </h2>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Bookings
                </span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#f59e0b' }}>
                  {stats.activeBookings}
                </h2>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Under Maintenance
                </span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#ef4444' }}>
                  {stats.maintenance}
                </h2>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            {/* Overdue Returns List */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>Overdue Returns</h3>
              {overdues.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No assets are currently overdue.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Asset Tag</th>
                        <th>Asset Name</th>
                        <th>Held By</th>
                        <th>Expected Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdues.map((item) => (
                        <tr key={item.id}>
                          <td><span className="badge badge-maintenance">{item.assetTag}</span></td>
                          <td>{item.assetName}</td>
                          <td>{item.userName} ({item.userEmail})</td>
                          <td style={{ color: 'var(--text-primary)' }}>
                            {new Date(item.expectedReturnDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notifications Feed */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '16px' }}>Recent Notifications</h3>
              {notifications.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new notifications.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderLeft: `3px solid ${
                          notif.type === 'success' ? '#14b8a6' : notif.type === 'warning' ? '#f59e0b' : '#6366f1'
                        }`,
                        fontSize: '0.85rem'
                      }}
                    >
                      <p style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>{notif.message}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
