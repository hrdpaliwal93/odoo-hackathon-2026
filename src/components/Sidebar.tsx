'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const links = [
    { name: 'Dashboard', href: '/dashboard', roles: ['Admin', 'AssetManager', 'DepartmentHead', 'Employee'] },
    { name: 'Assets Directory', href: '/assets', roles: ['Admin', 'AssetManager', 'DepartmentHead', 'Employee'] },
    { name: 'Allocations & Transfers', href: '/allocations', roles: ['Admin', 'AssetManager', 'DepartmentHead'] },
    { name: 'Resource Booking', href: '/bookings', roles: ['Admin', 'AssetManager', 'DepartmentHead', 'Employee'] },
    { name: 'Maintenance', href: '/maintenance', roles: ['Admin', 'AssetManager', 'DepartmentHead', 'Employee'] },
    { name: 'Audits', href: '/audits', roles: ['Admin', 'AssetManager', 'DepartmentHead', 'Employee'] }, // Employees can see if assigned
    { name: 'Reports & Analytics', href: '/reports', roles: ['Admin', 'AssetManager'] },
    { name: 'Organization Setup', href: '/admin', roles: ['Admin'] },
  ];

  const visibleLinks = links.filter((link) => link.roles.includes(user.role));

  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--primary-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '1.25rem'
        }}>
          AF
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Asset<span style={{ color: 'var(--primary)' }}>Flow</span>
          </h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Enterprise ERP
          </span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {visibleLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '10px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                transition: 'var(--transition-smooth)'
              }}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div style={{
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{user.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</span>
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--primary)',
            textTransform: 'uppercase',
            fontWeight: 800,
            marginTop: '4px',
            letterSpacing: '0.5px'
          }}>
            {user.role}
          </span>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost"
          style={{ width: '100%', padding: '8px 16px', fontSize: '0.85rem' }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
