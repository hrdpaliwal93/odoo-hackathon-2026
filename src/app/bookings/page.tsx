'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

interface Resource {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
}

interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  userName: string;
  startTime: string;
  endTime: string;
  status: string;
  userId: string;
}

export default function BookingsPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState('');

  // Booking Form
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Resource Create Form (Admin/Manager only)
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resName, setResName] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [resCategory, setResCategory] = useState('Room');
  const [resLocation, setResLocation] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingBookings, setLoadingBookings] = useState(false);

  const fetchResources = async () => {
    try {
      const response = await fetch('/api/resources');
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources);
        if (data.resources.length > 0 && !selectedResourceId) {
          setSelectedResourceId(data.resources[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  };

  const fetchBookings = async () => {
    if (!selectedResourceId) return;
    setLoadingBookings(true);
    try {
      const response = await fetch(`/api/bookings?resourceId=${selectedResourceId}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [selectedResourceId]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: selectedResourceId,
          startTime,
          endTime
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Booking failed');
        return;
      }

      setSuccess('Booking created successfully! Slot reserved.');
      setStartTime('');
      setEndTime('');
      fetchBookings();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status: 'Cancelled' })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to cancel booking');
        return;
      }

      setSuccess('Booking cancelled successfully');
      fetchBookings();
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resName,
          description: resDesc,
          category: resCategory,
          location: resLocation
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to create resource');
        return;
      }

      setSuccess('Bookable resource created successfully');
      setResName('');
      setResDesc('');
      setResCategory('Room');
      setResLocation('');
      setShowResourceForm(false);
      fetchResources();
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Shared Resource Booking</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Book rooms, vehicles, and equipment with real-time overlap validation.
          </p>
        </div>
        {['Admin', 'AssetManager'].includes(user?.role || '') && (
          <button onClick={() => setShowResourceForm(true)} className="btn btn-secondary">
            + New Bookable Resource
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
        {/* Reservation Planner Panel */}
        <div className="glass-card">
          <h3>Create Booking</h3>
          
          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="form-label">Select Resource</label>
            <select
              className="form-control"
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
            >
              <option value="">-- Select Resource --</option>
              {resources.map((res) => (
                <option key={res.id} value={res.id}>
                  [{res.category}] {res.name} ({res.location})
                </option>
              ))}
            </select>
          </div>

          {selectedResourceId && (
            <form onSubmit={handleBook}>
              <div className="form-group">
                <label className="form-label">Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Book Slot
              </button>
            </form>
          )}
        </div>

        {/* Calendar / Bookings Timeline Panel */}
        <div className="glass-card">
          <h3>Reservations Timeline</h3>
          
          {loadingBookings ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '20px' }}>Loading timeline...</p>
          ) : bookings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>
              No upcoming bookings. This resource is completely open.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              {bookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span className={`badge ${
                      b.status === 'Cancelled' ? 'badge-disposed' : 'badge-available'
                    }`} style={{ marginBottom: '8px' }}>
                      {b.status}
                    </span>
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      Reserved by: {b.userName}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <strong>Start:</strong> {new Date(b.startTime).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <strong>End:</strong> {new Date(b.endTime).toLocaleString()}
                    </p>
                  </div>
                  {b.status !== 'Cancelled' && (b.userId === user?.id || ['Admin', 'AssetManager'].includes(user?.role || '')) && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Resource Modal */}
      {showResourceForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>New Bookable Resource</h3>
            <form onSubmit={handleCreateResource} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Resource Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Room B2"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={resCategory}
                  onChange={(e) => setResCategory(e.target.value)}
                >
                  <option value="Room">Room</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Equipment">Equipment</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Floor 2"
                  value={resLocation}
                  onChange={(e) => setResLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Instructions</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Key is with office reception."
                  value={resDesc}
                  onChange={(e) => setResDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Resource
                </button>
                <button
                  type="button"
                  onClick={() => setShowResourceForm(false)}
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
