import React from 'react';
import { Shield, FileText, X, CheckCircle, Lock, Server, Eye, ExternalLink } from 'lucide-react';

export default function LegalModal({ isOpen, onClose, defaultTab = 'privacy' }) {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c1017] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Legal & Compliance Documentation</h2>
              <p className="text-xs text-zinc-400">Kairos Autonomous Engine Governance Policies</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Service</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-zinc-300 leading-relaxed scrollbar-thin">
          
          {/* ========================================================================= */}
          {/* TAB 1: TERMS OF SERVICE                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'terms' && (
            <div className="space-y-6">
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-200 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Last Updated: August 2026</strong> — Please read these Terms of Service carefully before connecting your Google Workspace, Notion workspace, or WhatsApp instance to Kairos Engine.
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  1. Acceptance of Terms
                </h3>
                <p>
                  By deploying, accessing, or authenticating with Kairos ("Service"), you agree to be bound by these Terms of Service. If you are operating Kairos on behalf of an organization, you represent that you have authority to bind that entity to these terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  2. Description of Kairos Service
                </h3>
                <p>
                  Kairos is an autonomous AI operational orchestrator that integrates third-party APIs (including Notion, Google Gmail API, OpenWA Gateway, and OpenRouter AI models) to ingest incoming requests, structure operational data, and sync task execution to user-owned Notion databases.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  3. OAuth & Third-Party API Connections
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-300">
                  <li>
                    <strong>Google API Authentication:</strong> You grant Kairos permission to access Gmail messages solely for parsing inbound operational requests and creating draft email responses when initiated.
                  </li>
                  <li>
                    <strong>Notion Integration:</strong> You authorize Kairos to initialize and update databases (Run Log, Invoices, Tasks, Requests, Documents) inside your connected Notion parent page.
                  </li>
                  <li>
                    <strong>WhatsApp Instance (OpenWA):</strong> You retain full responsibility for complying with WhatsApp Terms of Service and applicable anti-spam standards.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  4. User Conduct & Acceptable Use
                </h3>
                <p>
                  You agree not to use Kairos to transmit bulk unsolicited spam, perform unlawful automated outreach, compromise system integrity, or bypass third-party API rate limits.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  5. Intellectual Property & Data Ownership
                </h3>
                <p>
                  You retain complete ownership of all data, emails, WhatsApp messages, and Notion database items processed through your instance of Kairos. Kairos claims no ownership over your operational content.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  6. Limitation of Liability
                </h3>
                <p>
                  Kairos is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. Under no circumstances shall the developers or contributors of Kairos be liable for any direct, indirect, incidental, or consequential damages resulting from third-party API outages, automated AI draft errors, or service disruptions.
                </p>
              </section>

              <section className="space-y-2 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
                <p>For questions regarding our Terms of Service, please contact our support desk or open an issue on the official Kairos GitHub repository.</p>
              </section>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PRIVACY POLICY                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200 flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Privacy Policy (Google Workspace & OpenWA Compliant)</strong> — Kairos prioritizes complete user data privacy. We strictly adhere to Google API Services User Data Policy, including the Limited Use requirements.
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  1. Information We Access & Process
                </h3>
                <p>
                  Kairos processes data strictly necessary to execute autonomous operations for your account:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-300">
                  <li><strong>Gmail Data:</strong> Subject lines, senders, raw email content, and timestamp metadata fetched via Gmail API.</li>
                  <li><strong>WhatsApp Data:</strong> Inbound message text, media file attachments, sender phone numbers, and push names.</li>
                  <li><strong>Notion Workspace Tokens:</strong> API Secret Keys and Database IDs required to record operational logs.</li>
                  <li><strong>Account Metadata:</strong> SQLite local session state, email identifier, and OAuth refresh tokens stored securely.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  2. Google API Limited Use Disclosure
                </h3>
                <p className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                  Kairos's use and transfer to any other app of information received from Google APIs will adhere to 
                  <a 
                    href="https://developers.google.com/terms/api-services-user-data-policy" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-cyan-400 underline ml-1 font-semibold"
                  >
                    Google API Services User Data Policy
                  </a>, including the Limited Use requirements.
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-300 text-xs mt-2">
                  <li>We do <strong>NOT</strong> use Google user data to train generalized AI models.</li>
                  <li>We do <strong>NOT</strong> sell, transfer, or distribute your Gmail content to third-party ad networks or data brokers.</li>
                  <li>Email contents are processed solely to create structured operational cards and draft responses inside your personal Notion databases.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  3. How AI & OpenRouter Processing Works
                </h3>
                <p>
                  When inbound messages require AI classification or response generation, Kairos sends the message payload to OpenRouter API (utilizing models like Google Gemini or Anthropic Claude). Data sent to OpenRouter is transient, processed statelessly, and subject to zero-data-retention enterprise commitments.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  4. Data Storage & Retention
                </h3>
                <p>
                  All credentials, tokens, and execution idempotency keys are stored locally within your self-hosted SQLite engine database (`kairos.db`). Operational records reside inside your user-controlled Notion workspace. You can wipe local storage anytime by running reset scripts or deleting session keys.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  5. Your Privacy Rights & Controls
                </h3>
                <p>
                  You hold full control over your connected accounts. You can revoke Kairos's access at any time through:
                </p>
                <ul className="list-disc list-inside space-y-1 text-zinc-300 text-xs">
                  <li>Google Account Permissions Console (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-cyan-400 underline">myaccount.google.com/permissions</a>)</li>
                  <li>Notion Integration Settings</li>
                  <li>WhatsApp Linked Devices setting on your phone</li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
                <p>If you have any privacy requests or inquiries regarding data protection, please reach out to privacy@kairos-engine.io.</p>
              </section>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <span className="text-xs text-zinc-500">Kairos Autonomous Engine &bull; GDPR & Google OAuth Compliant</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
