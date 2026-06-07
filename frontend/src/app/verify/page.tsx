'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { ShieldCheck, ShieldAlert, Clock, User, BadgeCheck, AlertTriangle, Loader2 } from 'lucide-react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No QR token provided. Please scan a valid gate pass QR code.');
      setLoading(false);
      return;
    }

    verifyToken(token);
  }, [searchParams]);

  const verifyToken = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.publicVerifyQR(token);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const getPassTypeName = (type: string) => {
    switch (type) {
      case 'student_permanent': return 'Student Permanent Pass';
      case 'faculty_permanent': return 'Faculty Permanent Pass';
      case 'conference_temporary': return 'Conference Temporary Pass';
      case 'single_day_visitor': return 'Single Day Visitor Pass';
      default: return type;
    }
  };

  return (
    <div className="glass-panel" style={{
      width: '100%',
      maxWidth: '450px',
      padding: '35px',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
    }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Loader2 size={40} style={{ color: '#ffffff', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#94a3b8', marginTop: '16px', fontSize: '0.9rem' }}>Verifying QR code...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : error ? (
        /* Verification Failed */
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}>
            <ShieldAlert size={40} style={{ color: '#ffffff' }} />
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px 0' }}>
            VERIFICATION FAILED
          </h2>
          <p style={{ color: '#f87171', fontSize: '0.9rem', margin: '0 0 24px 0' }}>{error}</p>
          <div style={{
            padding: '12px', borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <AlertTriangle size={14} style={{ color: '#ffffff', flexShrink: 0 }} />
            The QR code may have expired, been tampered with, or is a screenshot. Ask the pass holder to show a fresh QR.
          </div>
        </div>
      ) : result?.valid ? (
        /* Verification Success */
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <BadgeCheck size={40} style={{ color: '#ffffff' }} />
            </div>
            <h2 style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px 0' }}>
              PASS VERIFIED
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>This gate pass is authentic and currently active.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pass Holder</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{result.user?.name || 'Unknown'}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pass Type</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{getPassTypeName(result.pass?.passType)}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Validity Period</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {new Date(result.pass?.startDate).toLocaleDateString()} — {new Date(result.pass?.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {result.user?.studentProfile?.rollNumber && (
              <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BadgeCheck size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Roll Number</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{result.user.studentProfile.rollNumber}</div>
                </div>
              </div>
            )}

            {result.pass?.passDetails?.visitorName && (
              <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Visitor</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {result.pass.passDetails.visitorName} ({result.pass.passDetails.visitorPhone})
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{
            marginTop: '20px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center'
          }}>
            Status: <strong style={{ color: '#ffffff' }}>{result.pass?.status?.toUpperCase()}</strong>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>No verification result.</div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: '#000000'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#ffffff', marginBottom: '5px' }}>
          <ShieldCheck size={36} />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.05em', margin: 0 }}>V-GATE</h1>
        </div>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>Gate Pass Verification</p>
      </div>

      <Suspense fallback={
        <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '35px', textAlign: 'center' }}>
          <Loader2 size={40} style={{ color: '#ffffff', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ color: '#94a3b8', marginTop: '16px', fontSize: '0.9rem' }}>Loading...</p>
        </div>
      }>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
