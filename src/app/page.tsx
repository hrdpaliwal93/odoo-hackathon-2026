'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [seeding, setSeeding] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const url = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      if (isLogin) {
        login(data.user);
      } else {
        setSuccess('Account registered successfully! You can now log in.');
        setIsLogin(true);
        setName('');
        setPassword('');
      }
    } catch (err) {
      setError('Connection failed. Make sure database is running.');
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/seed', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Database successfully reset and seeded! Try login with: admin@assetflow.com / password123');
      } else {
        setError(data.error || 'Failed to seed');
      }
    } catch (err) {
      setError('Failed to seed database');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'var(--primary-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.75rem',
            color: '#fff',
            marginBottom: '16px'
          }}>
            AF
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>AssetFlow</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Enterprise Asset & Resource Management
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ fontSize: '0.85rem' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </span>{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            HACKATHON / DEMO SANDBOX
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
          >
            {seeding ? 'Seeding...' : 'Reset & Seed Demo Data'}
          </button>
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <strong>Demo Accounts (password: password123):</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '6px' }}>
              <li>Admin: admin@assetflow.com</li>
              <li>Asset Mgr: sarah@assetflow.com</li>
              <li>Dept Head: priya@assetflow.com</li>
              <li>Employee: raj@assetflow.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
