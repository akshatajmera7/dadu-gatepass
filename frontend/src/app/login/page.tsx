'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setUser } from '../../lib/api';
import { KeyRound, Mail, ShieldCheck, Database, LogIn } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'student@campus.edu', pass: 'student123', color: '#6366f1' },
  { role: 'Faculty', email: 'faculty@campus.edu', pass: 'faculty123', color: '#10b981' },
  { role: 'Superintendent', email: 'superintendent@campus.edu', pass: 'super123', color: '#f59e0b' },
  { role: 'Supervisor', email: 'supervisor@campus.edu', pass: 'superv123', color: '#a855f7' },
  { role: 'Gate Security', email: 'security@campus.edu', pass: 'security123', color: '#06b6d4' },
  { role: 'Admin', email: 'admin@campus.edu', pass: 'admin123', color: '#ef4444' }
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seedStatus, setSeedStatus] = useState('');
  const router = useRouter();

  // Try to seed users automatically on mount
  useEffect(() => {
    api.seed()
      .then(() => setSeedStatus('Database users seeded successfully'))
      .catch(() => setSeedStatus('Database might already be seeded or local state is active'));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.login({ email, password });
      
      // Redirect based on role
      if (data.user.role === 'gate_security') {
        router.push('/gate');
      } else if (['hostel_superintendent', 'conference_supervisor', 'admin'].includes(data.user.role)) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setLoading(true);
    setError('');
    setEmail(acc.email);
    setPassword(acc.pass);

    try {
      const data = await api.login({ email: acc.email, password: acc.pass });
      
      if (data.user.role === 'gate_security') {
        router.push('/gate');
      } else if (['hostel_superintendent', 'conference_supervisor', 'admin'].includes(data.user.role)) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSeed = async () => {
    setSeedStatus('Seeding database...');
    try {
      await api.seed();
      setSeedStatus('Database seeded successfully!');
    } catch (err: any) {
      setSeedStatus(`Seeding failed: ${err.message}`);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'radial-gradient(circle at top left, #1e1b4b, #0b0f19 70%)'
    }}>
      
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#6366f1', marginBottom: '5px' }}>
          <ShieldCheck size={36} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.05em', margin: 0 }}>V-GATE</h1>
        </div>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>Gate Pass Management & Verification System</p>
      </div>

      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '35px',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', letterSpacing: '-0.02em' }}>
          Sign In
        </h2>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#64748b' }} />
              <input
                type="email"
                className="input-field"
                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
                placeholder="you@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#64748b' }} />
              <input
                type="password"
                className="input-field"
                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="glow-button"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '10px',
              height: '46px'
            }}
          >
            <LogIn size={18} />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          margin: '25px 0 15px 0',
          color: '#475569',
          fontSize: '0.85rem'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
          <span>OR QUICK DEMO LOGIN</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
        </div>

        {/* Demo buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.role}
              onClick={() => handleQuickLogin(acc)}
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                border: `1px solid rgba(255,255,255,0.05)`,
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = acc.color;
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
              }}
            >
              <span style={{ color: acc.color, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {acc.role}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                {acc.email}
              </span>
            </button>
          ))}
        </div>

        {/* Database seed controller helper */}
        <div style={{
          marginTop: '20px',
          paddingTop: '15px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#64748b'
        }}>
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '240px' }}>
            {seedStatus}
          </span>
          <button
            onClick={triggerManualSeed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: '#6366f1',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Database size={12} />
            Reset DB
          </button>
        </div>

      </div>
    </div>
  );
}
