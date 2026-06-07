'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, setUser, User } from '../../lib/api';
import { io } from 'socket.io-client';
import { ShieldAlert, LogOut, Radio, QrCode, Play, Terminal, Users, UserCheck, AlertTriangle, Camera, CameraOff } from 'lucide-react';

const PRESET_RFID_CARDS = [
  { name: 'Akshat (Student)', rfid: 'd3b07384-d113-4ec5-a587-3932e65c0001', tag: 'RFID_STUDENT_AKSHAT' },
  { name: 'Dr. Ramesh (Faculty)', rfid: 'd3b07384-d113-4ec5-a587-3932e65c0002', tag: 'RFID_FACULTY_RAMESH' },
  { name: 'Invalid Tag', rfid: 'unregistered-tag-9999', tag: 'RFID_UNKNOWN_CARD' }
];

export default function GateDashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; actionType?: string } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerInstance, setScannerInstance] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (scannerInstance) {
        scannerInstance.stop().catch(console.error);
      }
    };
  }, [scannerInstance]);

  useEffect(() => {
    const user = getUser();
    if (!user || (user.role !== 'gate_security' && user.role !== 'admin')) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);

    // Initialize WebSockets connection for live updates
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Connected to real-time logs socket');
    });

    socket.on('gate_log_activity', (newLog) => {
      console.log('Received live gate log:', newLog);
      setLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractTokenFromPayload = (raw: string): string => {
    // If the scanned value is a URL (new format), extract the token parameter
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const url = new URL(raw);
        const token = url.searchParams.get('token');
        if (token) return token;
      }
    } catch {
      // Not a valid URL, treat as raw payload
    }
    return raw;
  };

  const handleQRVerifyDirectly = async (payloadStr: string) => {
    if (!payloadStr) return;
    setLoading(true);
    setScanResult(null);

    const token = extractTokenFromPayload(payloadStr);
    try {
      const data = await api.verifyQRPayload(token);
      setScanResult({
        success: true,
        actionType: data.actionType,
        message: `ACCESS GRANTED: ${data.log.user?.name || 'Visitor'} verified successfully for ${data.actionType.toUpperCase()}`
      });
      
      // Append locally to prevent blank streams on WebSocket issues
      if (data.log) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.log.id)) return prev;
          return [data.log, ...prev];
        });
      }
      
      setQrInput('');
    } catch (err: any) {
      setScanResult({
        success: false,
        message: `ACCESS DENIED: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQRVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleQRVerifyDirectly(qrInput);
  };

  const startScanner = async () => {
    setCameraActive(true);
    setScanResult(null);
    const { Html5Qrcode } = await import('html5-qrcode');
    
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("reader");
      setScannerInstance(html5QrCode);
      
      html5QrCode.start(
        { facingMode: "environment" }, 
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          setQrInput(decodedText);
          await html5QrCode.stop();
          setCameraActive(false);
          setScannerInstance(null);
          await handleQRVerifyDirectly(decodedText);
        },
        () => {}
      ).catch((err) => {
        console.error("Scanner start failed:", err);
        setCameraActive(false);
        setScannerInstance(null);
      });
    }, 150);
  };

  const stopScanner = async () => {
    if (scannerInstance) {
      try {
        await scannerInstance.stop();
      } catch (err) {
        console.error(err);
      }
      setScannerInstance(null);
    }
    setCameraActive(false);
  };

  const handleRFIDVerify = async (tag: string) => {
    setLoading(true);
    setScanResult(null);
    setRfidInput(tag);
    try {
      const data = await api.simulateRFID(tag);
      setScanResult({
        success: true,
        actionType: data.actionType,
        message: `ACCESS GRANTED: ${data.log.user?.name || 'User'} verified successfully via RFID for ${data.actionType.toUpperCase()}`
      });

      // Append locally to prevent blank streams on WebSocket issues
      if (data.log) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.log.id)) return prev;
          return [data.log, ...prev];
        });
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: `ACCESS DENIED: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/login');
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Navbar */}
      <header className="glass-panel navbar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={24} style={{ color: '#ef4444', animation: 'pulse-glow 1.5s infinite' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#ef4444' }}>
            GATE SECURITY COMMAND CENTER
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
              {currentUser?.role.replace('_', ' ')}
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Command Dashboard Layout */}
      <main className="dashboard-grid" style={{ flex: 1 }}>
        
        {/* Left Side: Simulation Controllers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Scanner Simulation Result Banner */}
          {scanResult && (
            <div className="glass-card slide-up" style={{
              padding: '20px',
              borderLeft: `5px solid ${scanResult.success ? '#10b981' : '#ef4444'}`,
              backgroundColor: scanResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              boxShadow: scanResult.success ? '0 10px 30px -10px rgba(16, 185, 129, 0.2)' : '0 10px 30px -10px rgba(239, 68, 68, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                {scanResult.success ? (
                  <UserCheck size={24} style={{ color: '#10b981' }} />
                ) : (
                  <AlertTriangle size={24} style={{ color: '#ef4444' }} />
                )}
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: scanResult.success ? '#10b981' : '#ef4444',
                  letterSpacing: '0.05em'
                }}>
                  {scanResult.success ? 'Access Authorized' : 'Access Denied'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                {scanResult.message}
              </p>
            </div>
          )}

          {/* QR Code Scanner Simulation */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div className="scanner-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={20} style={{ color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>QR Code Scanner Simulator</h2>
              </div>

              <button
                type="button"
                onClick={cameraActive ? stopScanner : startScanner}
                className="glow-button"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: cameraActive ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: cameraActive ? '0 4px 10px rgba(239, 68, 68, 0.2)' : '0 4px 10px rgba(16, 185, 129, 0.2)'
                }}
              >
                {cameraActive ? <CameraOff size={14} /> : <Camera size={14} />}
                {cameraActive ? 'Stop Camera' : 'Scan via Camera'}
              </button>
            </div>
            
            {cameraActive && (
              <div style={{ marginBottom: '16px' }}>
                <div id="reader" style={{ width: '100%', maxWidth: '350px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              </div>
            )}

            <form onSubmit={handleQRVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Paste the encrypted payload string OR use the camera scanner button above:
              </p>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Paste AES encrypted QR token..."
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                style={{ resize: 'none', fontSize: '0.8rem' }}
              />
              <button type="submit" className="glow-button" disabled={loading || !qrInput}>
                {loading ? 'Evaluating...' : 'Simulate Scan & Verify'}
              </button>
            </form>
          </section>

          {/* RFID Card Simulator */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Radio size={20} style={{ color: '#06b6d4' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>RFID Card Simulator</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="rfid-custom-row" style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter custom card tag or search term..."
                  value={rfidInput}
                  onChange={(e) => setRfidInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => handleRFIDVerify(rfidInput)}
                  className="glow-button"
                  style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', boxShadow: '0 4px 14px 0 rgba(6, 182, 212, 0.3)' }}
                  disabled={loading || !rfidInput}
                >
                  Tap Card
                </button>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  RAPID DEMO RFID CARDS:
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {PRESET_RFID_CARDS.map((preset) => (
                    <button
                      key={preset.tag}
                      onClick={() => handleRFIDVerify(preset.rfid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                    >
                      <span style={{ fontWeight: 600 }}>{preset.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 600 }}>{preset.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Right Side: Real-time logs stream */}
        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            <Terminal size={20} style={{ color: '#ef4444' }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Live Activity Stream</h2>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: '20px',
              marginLeft: 'auto'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
              LIVE FEED
            </div>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            maxHeight: '600px',
            paddingRight: '6px'
          }}>
            {logs.length === 0 ? (
              <div style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#475569',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Users size={32} />
                <span style={{ fontSize: '0.85rem' }}>Waiting for gate activities... Swipe cards or scan QR codes to start logging.</span>
              </div>
            ) : (
              logs.map((log) => {
                const isDenied = log.actionType === 'denied';
                const isEntry = log.actionType === 'entry';
                
                return (
                  <div
                    key={log.id}
                    className="glass-card slide-up log-card"
                    style={{
                      padding: '12px 16px',
                      borderLeft: `4px solid ${isDenied ? '#ef4444' : isEntry ? '#10b981' : '#3b82f6'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {log.user?.name || 'Unknown User'}{' '}
                        {log.user?.studentProfile?.rollNumber && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                            ({log.user.studentProfile.rollNumber})
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        {log.notes}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Method: <strong style={{ textTransform: 'uppercase' }}>{log.scanType}</strong></span>
                        <span>•</span>
                        <span>Pass: <strong>{log.pass?.passType?.replace('_', ' ') || 'None'}</strong></span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: isDenied ? 'rgba(239, 68, 68, 0.15)' : isEntry ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isDenied ? '#ef4444' : isEntry ? '#10b981' : '#3b82f6'
                      }}>
                        {log.actionType}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
