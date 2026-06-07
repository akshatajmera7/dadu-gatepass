'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, setUser, User } from '../../lib/api';
import { LogOut, Calendar, PlusCircle, UserCheck, ShieldAlert, RefreshCw, QrCode, ClipboardList, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function UserDashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pass Request Form State
  const [passType, setPassType] = useState('student_permanent');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  // Additional visitor details
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');

  // QR Modal/Display state
  const [selectedPass, setSelectedPass] = useState<any | null>(null);
  const [qrPayload, setQrPayload] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(15);

  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);
    fetchPasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set default form values depending on user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'faculty') {
        setPassType('faculty_permanent');
      } else {
        setPassType('student_permanent');
      }
    }
  }, [currentUser]);

  // Handle TOTP QR rotation interval timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedPass && qrPayload) {
      timer = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            rotateQR(selectedPass.id);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [selectedPass, qrPayload]);

  const fetchPasses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPasses();
      setPasses(data.passes || []);
    } catch (err: any) {
      setError('Could not fetch your passes.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestLoading(true);
    setError('');

    const passDetails: any = { reason };
    if (passType === 'single_day_visitor') {
      passDetails.visitorName = visitorName;
      passDetails.visitorPhone = visitorPhone;
      passDetails.hostName = currentUser?.name;
    }

    try {
      await api.createPass({
        passType,
        startDate,
        endDate,
        passDetails
      });
      // Reset form
      setReason('');
      setVisitorName('');
      setVisitorPhone('');
      fetchPasses();
    } catch (err: any) {
      setError(err.message || 'Failed to submit pass request');
    } finally {
      setRequestLoading(false);
    }
  };

  const rotateQR = async (passId: string) => {
    try {
      const data = await api.generateQRPayload(passId);
      setQrPayload(data.payload);
      setQrCountdown(data.refreshInterval || 15);
    } catch (err: any) {
      console.error('Failed to rotate QR', err);
    }
  };

  const handleShowQR = async (pass: any) => {
    setSelectedPass(pass);
    setQrPayload('');
    setQrLoading(true);
    setQrCountdown(15);
    try {
      const data = await api.generateQRPayload(pass.id);
      setQrPayload(data.payload);
    } catch (err: any) {
      setError('Could not generate pass QR: ' + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/login');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return { color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'rejected': return { color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'pending_approval': return { color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.2)' };
      default: return { color: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', border: '1px solid rgba(148, 163, 184, 0.2)' };
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Navbar */}
      <header className="glass-panel navbar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={24} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>V-GATE PORTAL</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.name}</div>
            <div style={{
              fontSize: '0.75rem',
              color: '#6366f1',
              textTransform: 'uppercase',
              fontWeight: 700,
              letterSpacing: '0.05em'
            }}>
              {currentUser?.role.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dashboard-grid" style={{ flex: 1 }}>
        
        {/* Pass request form */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <PlusCircle size={20} style={{ color: '#6366f1' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Request a Pass</h2>
          </div>

          <form onSubmit={handleCreatePass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Pass Type</label>
              <select
                className="input-field"
                value={passType}
                onChange={(e) => setPassType(e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              >
                {currentUser?.role === 'student' && (
                  <>
                    <option value="student_permanent">Student Permanent Pass</option>
                    <option value="single_day_visitor">Single Day Visitor Pass (Host)</option>
                  </>
                )}
                {currentUser?.role === 'faculty' && (
                  <>
                    <option value="faculty_permanent">Faculty Permanent Pass</option>
                    <option value="single_day_visitor">Single Day Visitor Pass (Host)</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Start Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>End Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {passType === 'single_day_visitor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid #6366f1', paddingLeft: '12px', margin: '5px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Visitor Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter visitor's full name"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Visitor Phone</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="Enter visitor's mobile number"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Reason / Details</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Reason for outing or visitor visit details"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              className="glow-button"
              disabled={requestLoading}
              style={{ marginTop: '10px' }}
            >
              {requestLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </section>

        {/* Passes list and Rotating QR Code Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Active QR Code panel */}
          {selectedPass && (
            <section className="glass-panel slide-up" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                backgroundColor: '#6366f1'
              }}></div>
              
              <div className="qr-panel-content" style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div className="pulse-qr" style={{
                    padding: '16px',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(99, 102, 241, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {qrLoading ? (
                      <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0f19' }}>
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                    ) : (
                      qrPayload ? (
                        <QRCodeSVG value={qrPayload} size={180} />
                      ) : (
                        <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <ShieldAlert size={28} />
                        </div>
                      )
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>
                    <Clock size={12} />
                    <span>Rotates in {qrCountdown}s</span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 700 }}>Active Gate Pass QR</h3>
                  <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.4' }}>
                    Show this dynamic QR code to the scanner at the campus gate. It rotates every 15 seconds to prevent screenshots.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Pass Type:</span>{' '}
                      <span style={{ fontWeight: 600 }}>{getPassTypeName(selectedPass.passType)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Validity:</span>{' '}
                      <span style={{ fontWeight: 600 }}>
                        {new Date(selectedPass.startDate).toLocaleDateString()} to {new Date(selectedPass.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedPass.passDetails.visitorName && (
                      <div>
                        <span style={{ color: '#64748b' }}>Visitor:</span>{' '}
                        <span style={{ fontWeight: 600 }}>{selectedPass.passDetails.visitorName} ({selectedPass.passDetails.visitorPhone})</span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#64748b' }}>Status:</span>{' '}
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        ...getStatusStyle(selectedPass.status)
                      }}>
                        {selectedPass.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => rotateQR(selectedPass.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '16px',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={14} /> Force Rotate Code
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* List of Passes */}
          <section className="glass-panel" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ClipboardList size={20} style={{ color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Your Gate Passes</h2>
              </div>
              <button
                onClick={fetchPasses}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading passes...</div>
            ) : passes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                You have no passes yet. Request a pass using the form on the left.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="glass-card"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                        {getPassTypeName(pass.passType)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        <span>
                          {new Date(pass.startDate).toLocaleDateString()} - {new Date(pass.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      {pass.passDetails.reason && (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
                          Reason: {pass.passDetails.reason}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        ...getStatusStyle(pass.status)
                      }}>
                        {pass.status.replace('_', ' ')}
                      </span>

                      {pass.status === 'approved' && (
                        <button
                          onClick={() => handleShowQR(pass)}
                          className="glow-button"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: '32px'
                          }}
                        >
                          <QrCode size={14} />
                          Show QR
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  );
}
