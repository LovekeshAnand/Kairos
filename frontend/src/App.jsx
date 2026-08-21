import React, { useState, useEffect } from 'react';
import Plasma from './components/Plasma';

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });
  const [systemStatus, setSystemStatus] = useState({ connectedAccounts: [] });
  const [waStatus, setWaStatus] = useState({ status: 'checking', phone: null, pushName: null, qr: null });
  const [waLoading, setWaLoading] = useState(false);
  const [notionSetup, setNotionSetup] = useState({ apiKey: '', parentPage: '', loading: false, result: null, error: null });
  const [toast, setToast] = useState(null);

  // Check auth state from SQLite session
  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setAuthState({ loading: false, authenticated: true, user: data.user });
        fetchSystemStatus();
        fetchWhatsAppStatus();
      } else {
        setAuthState({ loading: false, authenticated: false, user: null });
      }
    } catch (err) {
      console.warn('Auth check error:', err);
      setAuthState({ loading: false, authenticated: false, user: null });
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/auth/system/status');
      const data = await res.json();
      setSystemStatus(data);
    } catch (err) {
      console.warn('System status error:', err);
    }
  };

  const fetchWhatsAppStatus = async (userInitiated = false) => {
    try {
      const res = await fetch('/auth/whatsapp/status');
      const data = await res.json();
      setWaStatus(data);
    } catch (err) {
      setWaStatus({ status: 'offline', error: err.message });
    }
  };

  useEffect(() => {
    checkAuth();
    const interval = setInterval(() => {
      if (authState.authenticated) {
        fetchSystemStatus();
        fetchWhatsAppStatus();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [authState.authenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      setAuthState({ loading: false, authenticated: false, user: null });
      setToast({ type: 'info', message: 'You have been signed out successfully.' });
    } catch (err) {
      alert('Logout failed: ' + err.message);
    }
  };

  const handleNotionSetup = async (e) => {
    e.preventDefault();
    if (!notionSetup.apiKey || !notionSetup.parentPage) {
      setNotionSetup(prev => ({ ...prev, error: 'Please enter both Notion Secret Token and Parent Page URL.' }));
      return;
    }
    setNotionSetup(prev => ({ ...prev, loading: true, error: null, result: null }));
    try {
      const res = await fetch('/auth/notion/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionApiKey: notionSetup.apiKey,
          parentPageInput: notionSetup.parentPage
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotionSetup(prev => ({ ...prev, loading: false, result: 'All 5 databases initialized successfully in your Notion page!' }));
        fetchSystemStatus();
      } else {
        setNotionSetup(prev => ({ ...prev, loading: false, error: data.error || 'Setup failed' }));
      }
    } catch (err) {
      setNotionSetup(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    await fetchWhatsAppStatus(true);
    setWaLoading(false);
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm('Are you sure you want to log out of WhatsApp?')) return;
    try {
      await fetch('/auth/whatsapp/disconnect', { method: 'POST' });
      setToast({ type: 'info', message: 'WhatsApp session logged out.' });
      fetchWhatsAppStatus();
    } catch (err) {
      alert('Disconnect error: ' + err.message);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      
      {/* Background WebGL Plasma Shader */}
      <div className="fixed inset-0 z-0 pointer-events-auto opacity-70">
        <Plasma 
          color="#06b6d4" 
          speed={0.65} 
          scale={1.2} 
          opacity={0.8} 
          renderScale={0.6}
          iterations={45} 
        />
      </div>

      {/* Floating Glassmorphic Header */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-white/10 bg-[#07090e]/70 backdrop-blur-xl sticky top-0 shadow-2xl">
        <div className="flex items-center gap-3">
          <img 
            src="/kairos logo transparent.png" 
            alt="Kairos Logo" 
            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                KAIROS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Operations Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous AI & Notion Control Interface</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Online (:3000)
          </div>

          {authState.authenticated && authState.user && (
            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <img 
                src={authState.user.picture || 'https://lh3.googleusercontent.com/a/default-user'} 
                alt="User Avatar" 
                className="w-8 h-8 rounded-full border border-cyan-400/50 shadow-sm"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-white leading-tight">{authState.user.name}</span>
                <span className="text-[11px] text-slate-400 leading-tight">{authState.user.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer font-medium"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">

        {/* Toast Alert */}
        {toast && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 flex items-center justify-between backdrop-blur-md animate-fadeIn">
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-cyan-300 font-bold ml-4 cursor-pointer">✕</button>
          </div>
        )}

        {/* VIEW 1: Full-Screen Authentication Gate */}
        {!authState.authenticated ? (
          <div className="w-full max-w-xl mx-auto my-auto flex flex-col items-center text-center">
            
            <div className="w-full bg-[#0d1527]/80 border border-white/15 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden">
              
              {/* Glowing Accent Top Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"></div>

              {/* Logo Glow */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-cyan-500/30 blur-2xl rounded-full scale-110"></div>
                <img 
                  src="/kairos logo transparent.png" 
                  alt="Kairos Logo" 
                  className="w-24 h-24 mx-auto object-contain relative z-10 drop-shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-pulse"
                />
              </div>

              <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                Welcome to Kairos
              </h2>
              <p className="text-sm text-slate-300 mb-8 max-w-md mx-auto leading-relaxed">
                Connect your business communication channels with 1-click Google Sign-in to enable autonomous Gmail, WhatsApp, and Notion operations.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <span className="text-cyan-400 text-base">✉️</span>
                  <span><strong>Unified Gmail AI</strong><br/><span className="text-slate-400">Real-time Pub/Sub sync</span></span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <span className="text-emerald-400 text-base">💬</span>
                  <span><strong>WhatsApp Gateway</strong><br/><span className="text-slate-400">Anti-ban & group support</span></span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <span className="text-purple-400 text-base">📑</span>
                  <span><strong>5 Notion Databases</strong><br/><span className="text-slate-400">Human approval gates</span></span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                  <span className="text-blue-400 text-base">🗄️</span>
                  <span><strong>SQLite Persistence</strong><br/><span className="text-slate-400">Isolated multi-tenant data</span></span>
                </div>
              </div>

              {/* Sign in with Google Button */}
              <a 
                href="/auth/google/login"
                className="w-full py-4 px-6 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5 shadow-[0_10px_25px_rgba(255,255,255,0.2)] cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.61z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.19l-2.92-2.26c-.8.54-1.83.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33c.71-2.13 2.69-3.71 5.03-3.71z"/>
                </svg>
                Sign in with Google
              </a>

              <p className="text-[11px] text-slate-400 mt-4">
                Grants identity verification and Gmail API permissions in one unified step.
              </p>
            </div>
          </div>
        ) : (

          /* VIEW 2: Authenticated Operations Hub */
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Dashboard Hero Banner */}
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#121c33]/90 via-[#0e1628]/90 to-[#16122d]/90 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                  Operations & Channel Hub
                </h2>
                <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Your business communication channels are connected. Notion acts as your human review interface while Kairos executes autonomous background workflows.
                </p>
              </div>
              <a 
                href="https://notion.so" 
                target="_blank" 
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-sm transition-all whitespace-nowrap shadow-lg"
              >
                📑 Open Notion Workspace ↗
              </a>
            </div>

            {/* 3-Column Onboarding & Management Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: 1-Click Notion Setup Wizard */}
              <div className="p-6 rounded-2xl bg-[#0f172a]/80 border border-blue-500/30 backdrop-blur-xl flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <span className="text-xl">📑</span> 1-Click Notion Setup
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Instantly construct and link your 5 operational databases inside your Notion workspace.
                  </p>

                  <form onSubmit={handleNotionSetup} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Notion Secret Token
                      </label>
                      <input 
                        type="password"
                        placeholder="ntn_..."
                        value={notionSetup.apiKey}
                        onChange={e => setNotionSetup(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Parent Page URL
                      </label>
                      <input 
                        type="text"
                        placeholder="https://notion.so/Kairos-Hub-..."
                        value={notionSetup.parentPage}
                        onChange={e => setNotionSetup(prev => ({ ...prev, parentPage: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {notionSetup.error && (
                      <p className="text-xs text-red-400">{notionSetup.error}</p>
                    )}
                    {notionSetup.result && (
                      <p className="text-xs text-emerald-400 font-medium">{notionSetup.result}</p>
                    )}

                    <button 
                      type="submit"
                      disabled={notionSetup.loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wide transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {notionSetup.loading ? '⏳ Constructing 5 Databases...' : '⚡ Auto-Create All 5 Databases'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Card 2: Gmail Integration Status */}
              <div className="p-6 rounded-2xl bg-[#0f172a]/80 border border-cyan-500/30 backdrop-blur-xl flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <span className="text-xl">✉️</span> Gmail Integration
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Active Google Cloud Pub/Sub & 20s polling listener. Analyzes incoming emails, discards marketing spam, and stages replies in Notion.
                  </p>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-xs text-cyan-300 mb-4 font-mono">
                    Active Mailbox: {authState.user.email}
                  </div>
                </div>

                <a 
                  href="/auth/google/login"
                  className="w-full py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-slate-200 font-semibold text-xs text-center transition-all cursor-pointer"
                >
                  🔄 Switch / Re-Authenticate Account
                </a>
              </div>

              {/* Card 3: WhatsApp Web Gateway */}
              <div className="p-6 rounded-2xl bg-[#0f172a]/80 border border-emerald-500/30 backdrop-blur-xl flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5 font-bold text-lg text-white">
                      <span className="text-xl">💬</span> WhatsApp Gateway
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                      waStatus.phone ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {waStatus.phone ? 'Connected' : 'Scan Required'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Self-hosted OpenWA Web Anti-Ban Gateway on port 2785. Supports direct chats, WhatsApp groups, and media documents.
                  </p>

                  {waStatus.phone ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono mb-4">
                      Paired Device: {waStatus.pushName || 'WhatsApp User'} (+{waStatus.phone})
                    </div>
                  ) : (
                    <div className="flex flex-col items-center my-3">
                      <div className="p-3 bg-white rounded-xl shadow-lg inline-block">
                        <img 
                          src={`/auth/whatsapp/qr.png?t=${Date.now()}`} 
                          alt="WhatsApp QR Code" 
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Scan with <strong>WhatsApp &gt; Linked Devices</strong>
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={handleConnectWhatsApp}
                    disabled={waLoading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {waLoading ? '⏳ Checking QR...' : '🔄 Refresh WhatsApp Connection'}
                  </button>
                  {waStatus.phone && (
                    <button 
                      onClick={handleDisconnectWhatsApp}
                      className="w-full py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-all cursor-pointer"
                    >
                      🔌 Disconnect WhatsApp
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* 5-Database Infrastructure Matrix */}
            <div className="mt-4">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span>🗄️</span> 5 Operational Databases
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <h4 className="font-bold text-xs text-white mb-1">📗 Run Log</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">Real-time audit records & diagnostic traces.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <h4 className="font-bold text-xs text-white mb-1">📄 Invoices</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">Flow A: Invoicing, approval gates & PDF dispatch.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <h4 className="font-bold text-xs text-white mb-1">✅ Tasks</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">Flow B: Meeting action items & assignee routing.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <h4 className="font-bold text-xs text-white mb-1">📥 Requests</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">Flow C: Inbound communications & draft responses.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <h4 className="font-bold text-xs text-white mb-1">📂 Documents</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">Central asset storage from WhatsApp & Email.</p>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-500 border-t border-white/10 bg-[#07090e]/80 backdrop-blur-md">
        Kairos Autonomous Operations Hub &bull; Powered by React, Vite, WebGL & Notion API
      </footer>

    </div>
  );
}
