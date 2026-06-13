'use client';

import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SessionEnded() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#090b11] overflow-hidden p-6 text-slate-100">
      {/* Decorative gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/15 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl glass-panel relative z-10 text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <CheckCircle2 className="h-6 w-6 text-white animate-bounce" />
        </div>

        <h2 className="text-xl font-bold">Feedback Submitted Successfully</h2>
        <p className="text-xs text-slate-400 leading-relaxed px-4">
          Thank you for rating your experience! Your support session has been securely closed. You may now close this browser tab.
        </p>

        <div className="pt-4 border-t border-slate-900 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>SupportLens Session Encryption</span>
        </div>
      </div>
    </div>
  );
}
