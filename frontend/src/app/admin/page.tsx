'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, setUser, User } from '../../lib/api';
import { Shield, CheckCircle, XCircle, LogOut, RefreshCw, FileSpreadsheet, Key, Database, AlertCircle, Sparkles } from 'lucide-react';

export default function AdminPortal() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [passId: string]: string }>({});
  const [error, setError] = useState('');
  
  // Tab Management
  const [activeTab, setActiveTab] = useState<'inbox' | 'bulk_gen' | 'swd_sync'>('inbox');

  // Bulk Generation Form State
  const [confName, setConfName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantsList, setParticipantsList] = useState(''); // Textarea with CSV of names/emails
  const [bulkStatus, setBulkStatus] = useState('');

  // SWD Sync State
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('swd-secret-api-key-abcde');
  const [swdStudent, setSwdStudent] = useState<any | null>(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user || !['hostel_superintendent', 'conference_supervisor', 'admin'].includes(user.role)) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);
    fetchPendingPasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingPasses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPasses({ status: 'pending_approval' });
      setPasses(data.passes || []);
    } catch (err: any) {
      setError('Could not fetch pending pass requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (passId: string, status: 'approved' | 'rejected') => {
    setActionLoading(passId);
    setError('');
    const commentText = comments[passId] || '';
    try {
      await api.updatePassStatus(passId, { status, comments: commentText });
      // Remove from active list
      setPasses((prev) => prev.filter((p) => p.id !== passId));
    } catch (err: any) {
      setError(`Failed to update status for pass: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confName || !startDate || !endDate || !participantsList) {
      setBulkStatus('Please fill in all bulk pass details.');
      return;
    }

    setBulkStatus('Processing bulk generation...');
    
    // Parse CSV lines: "Name, Email"
    const lines = participantsList.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let successCount = 0;
    
    for (const line of lines) {
      const parts = line.split(',');
      const name = parts[0]?.trim() || 'Participant';
      const email = parts[1]?.trim() || `participant-${Date.now()}@conf.com`;

      try {
        await api.createPass({
          passType: 'conference_temporary',
          startDate,
          endDate,
          passDetails: {
            conferenceName: confName,
            visitorName: name,
            visitorEmail: email,
            reason: `Conference Participant: ${confName}`
          }
        });
        successCount++;
      } catch (err) {
        console.error(`Failed bulk creation for ${name}`, err);
      }
    }

    setBulkStatus(`Successfully generated ${successCount} temporary passes for "${confName}"!`);
    setConfName('');
    setParticipantsList('');
    fetchPendingPasses();
  };

  const handleQuerySWD = async () => {
    if (!rollNumberInput) return;
    setSyncLoading(true);
    setSyncStatus('');
    setSwdStudent(null);
    try {
      const data = await api.getSWDStudent(rollNumberInput, apiKeyInput);
      setSwdStudent(data.student);
    } catch (err: any) {
      setSyncStatus(`SWD Lookup Failed: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleBlacklist = async (currentBlacklist: boolean) => {
    if (!swdStudent || !rollNumberInput) return;
    setSyncLoading(true);
    setSyncStatus('');
    try {
      const targetState = !currentBlacklist;
      const data = await api.syncSWDStudentStatus({ rollNumber: rollNumberInput, isBlacklisted: targetState }, apiKeyInput);
      setSyncStatus(`Sync Success: Student blacklist toggled to ${targetState}`);
      // Re-fetch local display
      setSwdStudent((prev: any) => ({
        ...prev,
        isBlacklisted: targetState
      }));
    } catch (err: any) {
      setSyncStatus(`Sync Failed: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Navbar */}
      <header className="glass-panel navbar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>V-GATE ADMIN CONSOLE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>
              {currentUser?.role.replace('_', ' ')}
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '10px', margin: '0 30px 20px 30px' }}>
        <button
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'inbox' ? '#6366f1' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'inbox' ? 'white' : '#94a3b8',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap' as any
          }}
        >
          Approval Inbox
        </button>

        {(currentUser?.role === 'conference_supervisor' || currentUser?.role === 'admin') && (
          <button
            onClick={() => setActiveTab('bulk_gen')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'bulk_gen' ? '#6366f1' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'bulk_gen' ? 'white' : '#94a3b8',
              transition: 'all 0.2s'
            }}
          >
            Bulk Temporary Passes
          </button>
        )}

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('swd_sync')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'swd_sync' ? '#6366f1' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'swd_sync' ? 'white' : '#94a3b8',
              transition: 'all 0.2s'
            }}
          >
            SWD Sync & Curfew
          </button>
        )}
      </div>

      {/* Main Area */}
      <main style={{ flex: 1, margin: '0 30px 30px 30px', display: 'flex', flexDirection: 'column' }} className="admin-main">
        
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

        {/* Tab 1: Approval Inbox */}
        {activeTab === 'inbox' && (
          <section className="glass-panel" style={{ padding: '30px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Pending Pass Requests Inbox</h2>
              <button onClick={fetchPendingPasses} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: 'auto' }}>
                <RefreshCw size={16} />
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Fetching pending requests...</div>
            ) : passes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                No pending pass requests found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="glass-card"
                    style={{
                      padding: '20px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div className="pass-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>
                          {pass.user?.name || 'Applicant'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6366f1', textTransform: 'uppercase', fontWeight: 700 }}>
                          {pass.passType.replace('_', ' ')}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                        <div>
                          Start: <strong>{new Date(pass.startDate).toLocaleDateString()}</strong>
                        </div>
                        <div>
                          End: <strong>{new Date(pass.endDate).toLocaleDateString()}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', backgroundColor: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '6px' }}>
                      <strong>Reason:</strong> {pass.passDetails?.reason || 'No reason provided.'}
                      {pass.passDetails?.visitorName && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>Visitor Info:</strong> {pass.passDetails.visitorName} ({pass.passDetails.visitorPhone})
                        </div>
                      )}
                    </div>

                    {/* Decision row */}
                    <div className="pass-card-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Add comments/remarks (optional)..."
                        value={comments[pass.id] || ''}
                        onChange={(e) => setComments({ ...comments, [pass.id]: e.target.value })}
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                      
                      <button
                        onClick={() => handleStatusChange(pass.id, 'approved')}
                        disabled={actionLoading === pass.id}
                        className="glow-button glow-success"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '36px'
                        }}
                      >
                        <CheckCircle size={14} /> Approve
                      </button>

                      <button
                        onClick={() => handleStatusChange(pass.id, 'rejected')}
                        disabled={actionLoading === pass.id}
                        className="glow-button glow-danger"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '36px'
                        }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Bulk pass creation */}
        {activeTab === 'bulk_gen' && (
          <section className="glass-panel" style={{ padding: '30px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <FileSpreadsheet size={20} style={{ color: '#a855f7' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Conference Participant Bulk Generator</h2>
            </div>

            {bulkStatus && (
              <div style={{
                padding: '12px',
                backgroundColor: bulkStatus.includes('Success') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                border: `1px solid ${bulkStatus.includes('Success') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                borderRadius: '8px',
                color: bulkStatus.includes('Success') ? '#10b981' : '#a855f7',
                fontSize: '0.875rem',
                marginBottom: '20px'
              }}>
                {bulkStatus}
              </div>
            )}

            <form onSubmit={handleBulkGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Conference Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. National Cyber Security Summit 2026"
                  value={confName}
                  onChange={(e) => setConfName(e.target.value)}
                  required
                />
              </div>

              <div className="date-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Participant List (CSV Format)</label>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Provide entry values in format: <code>Name, Email</code> (one participant per line)
                </p>
                <textarea
                  className="input-field"
                  rows={5}
                  placeholder="John Doe, john@gmail.com&#10;Alice Smith, alice@yahoo.com"
                  value={participantsList}
                  onChange={(e) => setParticipantsList(e.target.value)}
                  required
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </div>

              <button
                type="submit"
                className="glow-button"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)', boxShadow: '0 4px 14px 0 rgba(168, 85, 247, 0.3)' }}
              >
                Generate Bulk Temporary Passes
              </button>
            </form>
          </section>
        )}

        {/* Tab 3: SWD Integration Settings */}
        {activeTab === 'swd_sync' && (
          <section className="glass-panel" style={{ padding: '30px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Key size={20} style={{ color: '#06b6d4' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>SWD (Student Welfare Division) Status Sync</h2>
            </div>

            {syncStatus && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                color: '#06b6d4',
                fontSize: '0.875rem',
                marginBottom: '20px'
              }}>
                {syncStatus}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>SWD Access API Key</label>
                <input
                  type="text"
                  className="input-field"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Query Student Roll Number</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 2026A7PS0101P"
                    value={rollNumberInput}
                    onChange={(e) => setRollNumberInput(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleQuerySWD}
                  className="glow-button"
                  style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', height: '46px' }}
                  disabled={syncLoading || !rollNumberInput}
                >
                  Query SWD
                </button>
              </div>

              {swdStudent && (
                <div className="glass-card" style={{ padding: '20px', marginTop: '10px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} style={{ color: '#06b6d4' }} /> Student Profile Found in SWD
                  </h3>

                  <div className="swd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', marginBottom: '16px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Name:</span> <strong style={{ color: 'white' }}>{swdStudent.user?.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Roll Number:</span> <strong style={{ color: 'white' }}>{swdStudent.rollNumber}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Hostel Allocation:</span> <strong style={{ color: 'white' }}>{swdStudent.hostelName} ({swdStudent.roomNumber})</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Curfew Check status:</span>{' '}
                      <span style={{
                        color: swdStudent.isBlacklisted ? '#ef4444' : '#10b981',
                        fontWeight: 700
                      }}>
                        {swdStudent.isBlacklisted ? 'BLACKLISTED' : 'CLEAR'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleBlacklist(swdStudent.isBlacklisted)}
                      className="glow-button"
                      style={{
                        background: swdStudent.isBlacklisted ? '#10b981' : '#ef4444',
                        boxShadow: swdStudent.isBlacklisted ? '0 4px 14px 0 rgba(16, 185, 129, 0.3)' : '0 4px 14px 0 rgba(239, 68, 68, 0.3)',
                        padding: '8px 16px',
                        fontSize: '0.8rem'
                      }}
                      disabled={syncLoading}
                    >
                      {swdStudent.isBlacklisted ? 'Clear/Whitelist Student' : 'Blacklist/Restrict Student'}
                    </button>
                    
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />
                      Blacklisted students are immediately blocked from scanning passes.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
