import React from 'react';
import { ArrowLeft, Shield, Lock, Eye } from 'lucide-react';

export default function Privacy({ onBack }) {
  return (
    <div className="relative z-10 max-w-4xl w-full mx-auto px-6 py-12 text-zinc-300 animate-fadeIn">
      <button 
        onClick={onBack || (() => window.history.back())}
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white mb-8 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Operations Hub</span>
      </button>

      <div className="p-8 sm:p-12 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-8">
        <div className="border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <Shield className="w-4 h-4" />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-zinc-500 mt-1">Last Updated: August 21, 2026</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" /> 1. Information We Collect
          </h2>
          <p>
            When you use Kairos, we collect and process only the information necessary to provide autonomous operations services:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
            <li><strong>Account Information:</strong> Google profile name, email address, and OAuth tokens.</li>
            <li><strong>Communication Data:</strong> Inbound email headers, snippets, and WhatsApp message payloads received via authorized webhooks.</li>
            <li><strong>Notion Workspace Data:</strong> Notion parent page IDs and database IDs linked by you.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" /> 2. Google User Data & Limited Use Disclosure
          </h2>
          <p>
            Kairos's use and transfer to any other app of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Google API Services User Data Policy</a>, including the Limited Use requirements:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
            <li>We only access Gmail data to stage incoming action items in your personal Notion database and send authorized replies.</li>
            <li>We do not sell, rent, or transfer your Google user data to third parties or advertising brokers.</li>
            <li>We do not use Google user data to train generalized AI models without explicit consent.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">3. Data Storage & Local SQLite Isolation</h2>
          <p>
            All authentication sessions, user profiles, and channel mappings are stored in a dedicated local SQLite database instance (`data/kairos.db`). Each user's data and message processing pipelines are strictly isolated.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">4. Data Retention & Revocation</h2>
          <p>
            You can revoke Kairos's access to your Google account at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Google Account Permissions</a>. You can also sign out or request complete data deletion by contacting our team.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">5. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please contact: <span className="text-zinc-300 font-mono">privacy@kairos-engine.io</span>
          </p>
        </section>

        <div className="pt-6 border-t border-zinc-800 text-xs text-zinc-500">
          Kairos Operations Hub &bull; Committed to enterprise security and user privacy.
        </div>
      </div>
    </div>
  );
}
