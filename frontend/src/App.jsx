import React, { useState, useEffect } from 'react';
import Plasma from './components/Plasma';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { 
  CheckCircle2, 
  ArrowRight, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  Bot, 
  Sparkles, 
  LogOut, 
  QrCode, 
  RefreshCw, 
  FileText, 
  Database,
  Mail,
  MessageSquare,
  FileSpreadsheet,
  CheckSquare,
  Inbox,
  FolderClosed,
  ChevronRight,
  Info
} from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname || '/');
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });
  const [systemStatus, setSystemStatus] = useState({ connectedAccounts: [] });
  const [waStatus, setWaStatus] = useState({ status: 'checking', phone: null, pushName: null, qr: null });
  const [waLoading, setWaLoading] = useState(false);
  const [notionSetup, setNotionSetup] = useState({ apiKey: '', parentPage: '', loading: false, result: null, error: null });

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePop = () => setCurrentRoute(window.location.pathname);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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
      if (data.notionConfig) {
        setNotionSetup(prev => ({
          ...prev,
          apiKey: prev.apiKey || data.notionConfig.apiKey || '',
          parentPage: prev.parentPage || data.notionConfig.parentPage || ''
        }));
      }
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
    fetchSystemStatus();
    const interval = setInterval(() => {
      fetchSystemStatus();
      if (authState.authenticated) {
        fetchWhatsAppStatus();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [authState.authenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      setAuthState({ loading: false, authenticated: false, user: null });
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
        setNotionSetup(prev => ({ ...prev, loading: false, result: 'All 5 databases initialized and linked successfully!' }));
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
      fetchWhatsAppStatus();
    } catch (err) {
      alert('Disconnect error: ' + err.message);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#080b11] text-zinc-100 flex flex-col font-sans antialiased selection:bg-purple-500 selection:text-white">
      
      {/* Background WebGL Plasma Shader in Light Purplish */}
      <div className="fixed inset-0 z-0 pointer-events-auto opacity-55">
        <Plasma 
          color="#c084fc" 
          speed={0.45} 
          scale={1.25} 
          opacity={0.7} 
          renderScale={0.55}
          iterations={45} 
        />
      </div>

      {/* Minimalist Professional Navbar */}
      <nav className="relative z-30 w-full px-6 md:px-12 py-3.5 flex items-center justify-between border-b border-zinc-800/80 bg-[#080b11]/85 backdrop-blur-md sticky top-0">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img 
            src="/kairos logo.png" 
            alt="Kairos" 
            className="w-8 h-8 rounded-lg object-cover border border-zinc-700/60 shadow-sm group-hover:border-zinc-500 transition-all" 
          />
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white font-mono">
              kairos
            </span>
            <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              v2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono text-zinc-400">engine :3000</span>
          </div>

          <a 
            href="https://github.com/LovekeshAnand/Kairos" 
            target="_blank" 
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {authState.authenticated && authState.user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-zinc-800">
              <img 
                src={authState.user.picture || 'https://lh3.googleusercontent.com/a/default-user'} 
                alt={authState.user.name} 
                className="w-7 h-7 rounded-full border border-zinc-700 object-cover"
              />
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-medium text-zinc-200 leading-tight">{authState.user.name}</span>
                <span className="text-[11px] text-zinc-500 leading-tight">{authState.user.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <a 
              href="/auth/google/login"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-white text-zinc-950 hover:bg-zinc-200 transition-all flex items-center gap-1.5 shadow-sm font-sans"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </nav>

      {/* Standalone Route Views */}
      {currentRoute === '/terms' ? (
        <Terms onBack={() => navigate('/')} />
      ) : currentRoute === '/privacy' ? (
        <Privacy onBack={() => navigate('/')} />
      ) : (
        /* Main Container */
        <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-12">
        
        {/* ========================================================================= */}
        {/* SECTION 1: HERO SECTION                                                   */}
        {/* ========================================================================= */}
        <section className="text-center flex flex-col items-center pt-4 pb-2">
          
          {/* Logo Showcase */}
          <div className="mb-6 relative">
            <img 
              src="/kairos logo.png" 
              alt="Kairos Logo" 
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl mx-auto object-cover border border-zinc-700/80 shadow-2xl" 
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Autonomous AI Engine with Notion Control Interface</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl leading-tight sm:leading-tight mb-4">
            Autonomous Business Operations, Staged in Notion.
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed mb-8">
            Kairos continuously ingests, classifies, and drafts responses for your Gmail, WhatsApp, and meeting transcripts. You review and approve inside Notion — Kairos executes the real-world dispatch.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!authState.authenticated && (
              <a 
                href="/auth/google/login"
                className="px-6 py-3 rounded-lg bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-sm flex items-center gap-2.5 transition-all shadow-md cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.61z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.19l-2.92-2.26c-.8.54-1.83.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33c.71-2.13 2.69-3.71 5.03-3.71z"/>
                </svg>
                Sign in with Google
              </a>
            )}

            <a 
              href="https://notion.so" 
              target="_blank" 
              rel="noreferrer"
              className="px-5 py-3 rounded-lg border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 font-medium text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm"
            >
              <span>Open Notion Workspace</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl mt-12 text-left">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">Flow A</span>
              <span className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" /> Invoices & PDFs
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">Flow B</span>
              <span className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" /> Meet Transcripts
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">Flow C</span>
              <span className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp & Gmail
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">Security</span>
              <span className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" /> SQLite Tenancy
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: STEP-BY-STEP SETUP & ONBOARDING WORKFLOW                       */}
        {/* ========================================================================= */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Setup & Operational Controls
              </h2>
              <p className="text-xs text-zinc-400">Complete the 3 quick steps below to connect all your business communication channels.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* STEP 1: Google Authentication */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">Step 1</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    authState.authenticated ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {authState.authenticated ? 'Connected' : 'Pending'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" /> Google Sign-in
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Authenticates your identity and grants permissions for automated Gmail ingestion and draft response dispatch in a single step.
                </p>

                {authState.authenticated && authState.user && (
                  <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 font-mono mb-4">
                    Active: {authState.user.email}
                  </div>
                )}
              </div>

              {!authState.authenticated ? (
                <a 
                  href="/auth/google/login"
                  className="w-full py-2.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Connect with Google</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              ) : (
                <a 
                  href="/auth/google/login"
                  className="w-full py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs text-center transition-all cursor-pointer"
                >
                  Switch Account
                </a>
              )}
            </div>

            {/* STEP 2: Notion Operations Hub Setup */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl flex flex-col justify-between shadow-xl md:col-span-2">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">Step 2</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    systemStatus.notion ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {systemStatus.notion ? `Connected (${systemStatus.notionBot || 'Bot Active'})` : 'Notion Engine'}
                  </span>
                </div>
                
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" /> 1-Click Notion Operations Hub Setup
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Constructs and links all 5 operational databases inside your own Notion workspace.
                </p>

                {/* Notion Page Creation Guide Box */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-200 mb-2 text-[11px]">
                    <Info className="w-3.5 h-3.5 text-purple-400" /> How to create your Notion page:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px] leading-relaxed">
                    <li>Open Notion and create an empty page titled <strong className="text-zinc-200">"Kairos Operations Hub"</strong>.</li>
                    <li>Click <strong className="text-zinc-200">Share</strong> (or •••) &gt; <strong className="text-zinc-200">Add connections</strong> &gt; Select your Kairos Integration.</li>
                    <li>Copy your page URL from your browser address bar and paste it below.</li>
                  </ol>
                </div>

                <form onSubmit={handleNotionSetup} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Notion Secret Token
                    </label>
                    <input 
                      type="text"
                      placeholder="ntn_..."
                      value={notionSetup.apiKey}
                      onChange={e => setNotionSetup(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Parent Page URL
                    </label>
                    <input 
                      type="text"
                      placeholder="https://notion.so/Kairos-Operations-Hub-..."
                      value={notionSetup.parentPage}
                      onChange={e => setNotionSetup(prev => ({ ...prev, parentPage: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    {notionSetup.error && <p className="text-xs text-red-400 mb-2">{notionSetup.error}</p>}
                    {notionSetup.result && <p className="text-xs text-emerald-400 mb-2 font-medium">{notionSetup.result}</p>}
                    <button 
                      type="submit"
                      disabled={notionSetup.loading}
                      className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {notionSetup.loading ? 'Constructing 5 Databases...' : 'Auto-Create All 5 Notion Databases'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* STEP 3: WhatsApp Web Gateway */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl flex flex-col justify-between shadow-xl md:col-span-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Step 3</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      waStatus.phone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {waStatus.phone ? 'Paired' : 'Scan Required'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" /> WhatsApp Anti-Ban Gateway (OpenWA)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Connect your WhatsApp device to ingest 1-on-1 chats and group messages directly into Notion with AI draft replies.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleConnectWhatsApp}
                    disabled={waLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? 'animate-spin' : ''}`} />
                    <span>{waLoading ? 'Checking...' : 'Refresh Status'}</span>
                  </button>
                  {waStatus.phone && (
                    <button 
                      onClick={handleDisconnectWhatsApp}
                      className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-all cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {waStatus.phone ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono flex items-center justify-between">
                  <span>Paired Device: <strong>{waStatus.pushName || 'WhatsApp User'}</strong> (+{waStatus.phone})</span>
                  <span className="text-emerald-400 text-[11px]">Ready for Webhook Dispatch</span>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col items-center text-center">
                  <div className="p-2.5 bg-white rounded-xl shadow-lg inline-block mb-3">
                    <img 
                      src={`/auth/whatsapp/qr.png?t=${Date.now()}`} 
                      alt="WhatsApp QR Code" 
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <p className="text-xs text-zinc-300 font-medium">
                    Open WhatsApp on your phone &gt; Settings &gt; <strong>Linked Devices</strong> &gt; Scan QR Code
                  </p>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: 5 CONNECTED NOTION DATABASES MATRIX                            */}
        {/* ========================================================================= */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Notion Operational Databases
              </h2>
              <p className="text-xs text-zinc-400">5 interconnected databases mapped directly to your Notion workspace.</p>
            </div>
            <a 
              href="https://notion.so" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <span>View in Notion</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Database className="w-4 h-4" />
                <h4 className="font-bold text-xs text-white">Run Log</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">Immutable execution trace and diagnostic timeline.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <FileSpreadsheet className="w-4 h-4" />
                <h4 className="font-bold text-xs text-white">Invoices</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">Flow A: Invoice staging, approval gate & PDF dispatch.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <CheckSquare className="w-4 h-4" />
                <h4 className="font-bold text-xs text-white">Tasks</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">Flow B: Meeting action items & assignee routing.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-cyan-400 mb-2">
                <Inbox className="w-4 h-4" />
                <h4 className="font-bold text-xs text-white">Requests</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">Flow C: Inbound emails, WhatsApp chats & AI draft responses.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <FolderClosed className="w-4 h-4" />
                <h4 className="font-bold text-xs text-white">Documents</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">Central asset archive for inbound WhatsApp and Email files.</p>
            </div>

          </div>
        </section>

        </main>
      )}

      {/* Minimalist Footer */}
      <footer className="relative z-20 py-6 text-xs text-zinc-500 border-t border-zinc-800/60 bg-[#080b11]/90 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between px-6 md:px-12 gap-4">
        <div>
          Kairos Autonomous Operations Hub &bull; Backed by SQLite, Google Cloud & Notion API
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <a 
            href="/terms"
            onClick={(e) => { e.preventDefault(); navigate('/terms'); }}
            className="hover:text-zinc-200 transition text-zinc-400 cursor-pointer"
          >
            Terms of Service
          </a>
          <span>&bull;</span>
          <a 
            href="/privacy"
            onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}
            className="hover:text-zinc-200 transition text-zinc-400 cursor-pointer"
          >
            Privacy Policy
          </a>
        </div>
      </footer>

    </div>
  );
}
