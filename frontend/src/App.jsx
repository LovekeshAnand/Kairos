import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Zap, 
  Database, 
  Mail, 
  MessageSquare, 
  Cpu, 
  Play, 
  ArrowRight,
  ShieldCheck,
  Radio,
  Terminal
} from 'lucide-react';

function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [lastCheck, setLastCheck] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealth(data);
      setLastCheck(new Date().toLocaleTimeString());
      addLog(`Fetched health status: ${data.service} [${data.status}]`, 'success');
    } catch (err) {
      addLog(`Failed to fetch engine health: ${err.message}`, 'error');
      setHealth({
        status: 'offline',
        service: 'Kairos Engine (Unreachable)',
        timestamp: new Date().toISOString(),
        integrations: {
          notion: 'offline',
          openwa: 'offline',
          gmail: 'unconfigured',
          openrouter: 'unconfigured'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ id: Date.now(), time, message, type }, ...prev.slice(0, 19)]);
  };

  const triggerSimulation = async (type) => {
    setSimulating(true);
    addLog(`Initiating simulation event [${type}]...`, 'info');
    try {
      let endpoint = '/webhooks/simulate';
      let payload = { type };
      
      if (type === 'health') {
        await fetchHealth();
        setSimulating(false);
        return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      addLog(`Simulation result [${type}]: ${JSON.stringify(data)}`, 'success');
    } catch (err) {
      addLog(`Simulation failed: ${err.message}`, 'error');
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    if (status === 'connected' || status === 'configured' || status === 'online') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {status.toUpperCase()}
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          DEGRADED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header Navigation */}
        <header className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg glow-cyan">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Kairos Engine
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  v2.0 Operations
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Autonomous AI Operations Interface & Notion Action Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Last Synced</p>
              <p className="text-xs font-mono font-medium text-slate-200">{lastCheck || 'Syncing...'}</p>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition duration-150 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              Refresh Status
            </button>
          </div>
        </header>

        {/* Integration Status Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              Integration Health Matrix
            </h2>
            {health && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Live Poller Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Notion Database */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                  <Database className="w-5 h-5" />
                </div>
                {getStatusBadge(health?.integrations?.notion || 'checking')}
              </div>
              <h3 className="font-semibold text-slate-200 text-base">Notion Workspace</h3>
              <p className="text-xs text-slate-400 mt-1">Inbox, Invoices & Requests Databases</p>
            </div>

            {/* WhatsApp Gateway */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                {getStatusBadge(health?.integrations?.openwa || 'checking')}
              </div>
              <h3 className="font-semibold text-slate-200 text-base">OpenWA Gateway</h3>
              <p className="text-xs text-slate-400 mt-1">Port 2785 Inbound & Outbound Webhook</p>
            </div>

            {/* Gmail API */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
                  <Mail className="w-5 h-5" />
                </div>
                {getStatusBadge(health?.integrations?.gmail || 'checking')}
              </div>
              <h3 className="font-semibold text-slate-200 text-base">Gmail API Watch</h3>
              <p className="text-xs text-slate-400 mt-1">Pub/Sub Notifications & Auto Sync</p>
            </div>

            {/* OpenRouter AI */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                {getStatusBadge(health?.integrations?.openrouter || 'checking')}
              </div>
              <h3 className="font-semibold text-slate-200 text-base">OpenRouter AI</h3>
              <p className="text-xs text-slate-400 mt-1">Gemini / Claude Pipeline Processor</p>
            </div>
          </div>
        </section>

        {/* Workflow & Action Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Simulator & Action Controls */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Play className="w-5 h-5 text-cyan-400" />
                Diagnostic Console
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Trigger manual test webhooks and inspect real-time server response.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => triggerSimulation('health')}
                disabled={simulating}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 transition text-sm font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Run Engine Diagnostics
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => triggerSimulation('whatsapp_inbound')}
                disabled={simulating}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 transition text-sm font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Simulate WhatsApp Inbound
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => triggerSimulation('gmail_sync')}
                disabled={simulating}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 transition text-sm font-medium"
              >
                <span className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-rose-400" />
                  Trigger Gmail Sync
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Pipeline Architecture
              </h4>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
                <li>Inbound Webhook received (Gmail / WhatsApp)</li>
                <li>OpenRouter AI structures raw message & draft</li>
                <li>Notion item created with status <code className="text-purple-300 font-mono">new</code></li>
                <li>User updates status to <code className="text-emerald-300 font-mono">approved</code></li>
                <li>Background Poller dispatches reply automatically</li>
              </ol>
            </div>
          </div>

          {/* Activity Log Stream */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  Live Event Stream
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {logs.length} events logged
                </span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 font-mono text-xs max-h-80 overflow-y-auto space-y-2.5 scrollbar-thin">
                {logs.length === 0 ? (
                  <p className="text-slate-500 italic py-4 text-center">
                    No activity logged yet. Click "Refresh Status" or trigger a diagnostic simulation.
                  </p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-500 shrink-0">{log.time}</span>
                      <span className={
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'error' ? 'text-rose-400' : 'text-slate-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Express Server Port: <strong className="text-slate-200">3000</strong></span>
              </div>
              <div>
                <span>Vite Dev Proxy: <strong className="text-slate-200">5173</strong></span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;
