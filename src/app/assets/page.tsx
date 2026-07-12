'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Asset {
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

interface Category {
  id: string;
  name: string;
}

export default function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [condition, setCondition] = useState('New');
  const [location, setLocation] = useState('');
  const [isSharedBookable, setIsSharedBookable] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAssets = async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (filterCategory) q.append('categoryId', filterCategory);
      if (filterStatus) q.append('status', filterStatus);

      const response = await fetch(`/api/assets?${q.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchAssets().then(() => setLoading(false));
  }, [search, filterCategory, filterStatus]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          categoryId,
          serialNumber,
          acquisitionDate,
          acquisitionCost,
          condition,
          location,
          isSharedBookable
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess(data.message);
      // Reset form
      setName('');
      setCategoryId('');
      setSerialNumber('');
      setAcquisitionDate('');
      setAcquisitionCost('');
      setCondition('New');
      setLocation('');
      setIsSharedBookable(false);
      fetchAssets();
    } catch (err) {
      setError('Connection failed');
    }
  };

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
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Asset Inventory</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Central asset registry, tracking, and life-cycle auditing.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
        {/* Register Asset Panel */}
        {['Admin', 'AssetManager'].includes(user?.role || '') && (
          <div className="glass-card">
            <h3>Register New Asset</h3>
            <form onSubmit={handleRegister} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Dell Latitude 5420"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. SN-998822A"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Acquisition Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 1200.00"
                  value={acquisitionCost}
                  onChange={(e) => setAcquisitionCost(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Acquisition Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Condition</label>
                <select
                  className="form-control"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. HQ Room 402"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="sharedCheckbox"
                  checked={isSharedBookable}
                  onChange={(e) => setIsSharedBookable(e.target.checked)}
                />
                <label htmlFor="sharedCheckbox" className="form-label" style={{ marginBottom: 0 }}>
                  Mark as shared/bookable resource
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Register Asset
              </button>
            </form>
          </div>
        )}

        {/* Assets List Panel */}
        <div className="glass-card" style={{ gridColumn: ['Admin', 'AssetManager'].includes(user?.role || '') ? 'auto' : 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
            <h3>Asset Directory</h3>
            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search tag/serial/name..."
                style={{ width: '200px', padding: '8px 12px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: '150px', padding: '8px 12px' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                className="form-control"
                style={{ width: '150px', padding: '8px 12px' }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Allocated">Allocated</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Lost">Lost</option>
                <option value="Retired">Retired</option>
                <option value="Disposed">Disposed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading directory...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset Name</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Current Holder</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={{ fontWeight: 600 }}>{asset.assetTag}</td>
                      <td>{asset.name}</td>
                      <td>{asset.categoryName}</td>
                      <td>{asset.location}</td>
                      <td>{getStatusBadge(asset.status)}</td>
                      <td>
                        {asset.holderName ? (
                          `${asset.holderName} (${asset.departmentName || 'Bench'})`
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/assets/${asset.id}`}
                          className="btn btn-ghost"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                          View History
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {assets.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No assets found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
