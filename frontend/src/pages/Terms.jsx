import React from 'react';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

export default function Terms({ onBack }) {
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
          <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <FileText className="w-4 h-4" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
          <p className="text-xs text-zinc-500 mt-1">Last Updated: August 21, 2026</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Kairos ("the Service", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">2. Description of Service</h2>
          <p>
            Kairos is an autonomous operations engine that connects to your communication channels (including Gmail, WhatsApp, and Google Meet transcripts) and interfaces with your Notion workspace. Kairos performs automated data classification, document staging, draft generation, and human-in-the-loop approval workflows.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">3. User Responsibilities & Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your credentials, Notion API tokens, and connected accounts. You agree not to use the Service for any unlawful activities, spam dispatch, harassment, or violations of third-party platform terms (including WhatsApp and Google Terms of Service).
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">4. Human-in-the-Loop & Dispatch Authorization</h2>
          <p>
            You acknowledge that outgoing communications dispatched via Kairos are subject to your review in Notion. Changing status to "Approved" constitutes explicit authorization for Kairos to dispatch the associated email, WhatsApp message, or document.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">5. Limitation of Liability</h2>
          <p>
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. To the fullest extent permitted by law, Kairos and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-bold text-white">6. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued use of the Service after any such changes constitutes your acceptance of the updated terms.
          </p>
        </section>

        <div className="pt-6 border-t border-zinc-800 text-xs text-zinc-500">
          For inquiries regarding these Terms of Service, contact: <span className="text-zinc-300 font-mono">support@kairos-engine.io</span>
        </div>
      </div>
    </div>
  );
}
