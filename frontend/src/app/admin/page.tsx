'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, ArrowLeft, RefreshCw, Activity, Users, Video, 
  Trash2, AlertTriangle, User, ShieldCheck
} from 'lucide-react';
import { api, getAuthToken, getCurrentUser } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (!token || !user) {
      router.push('/');
    } else {
      loadAdminData();
    }
  }, [router]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const data = await api.adminGetActiveSessions();
      setActiveSessions(data);
    } catch (err: any) {
      toast('Access Error', err.message || 'Unable to retrieve administrative logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForceTerminate = async (token: string, customerName: string) => {
    const confirmation = confirm(`[CRITICAL] Force terminate the live support session with customer "${customerName}"? Both parties will be disconnected immediately.`);
    if (!confirmation) return;

    try {
      await api.adminTerminateSession(token);
      toast('Session Terminated', `Session with ${customerName} has been forcefully ended.`, 'success');
      loadAdminData();
    } catch (err: any) {
      toast('Termination Failed', err.message || 'Server error during force termination.', 'error');
    }
  };

  // Calculations
  const liveSessionCount = activeSessions.length;
  const activeUserCount = activeSessions.reduce((acc, curr) => acc + (curr.activeParticipantCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col text-slate-100">
      {/* Admin Header */}
      <header className="border-b border-amber-950/20 bg-amber-950/5 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldAlert className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                <span>SupportLens System Watch</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                  Admin
                </span>
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold leading-none">SFU Signaling Metrics</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-950 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Agent Console</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1 space-y-8 animate-fadeIn">
        
        {/* Warning Banner */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Administrative Overview Mode</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              This dashboard provides complete visibility over all ongoing support channels. Direct actions, including force-terminating media tracks, are recorded in the central database event logs.
            </p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Channels</span>
              <p className="text-3xl font-bold text-slate-100 mt-2">{liveSessionCount}</p>
            </div>
            <Video className="h-8 w-8 text-amber-500/60" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Sockets</span>
              <p className="text-3xl font-bold text-slate-100 mt-2">{activeUserCount}</p>
            </div>
            <Users className="h-8 w-8 text-indigo-500/60" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">SFU Router Status</span>
              <div className="flex items-center gap-1.5 mt-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">ONLINE</span>
              </div>
            </div>
            <Activity className="h-8 w-8 text-emerald-500/60 animate-pulse" />
          </div>
        </div>

        {/* Grid and list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">All Live Support Sessions</h3>
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-7 w-7 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Scanning network channels...</p>
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
              <ShieldCheck className="h-10 w-10 text-slate-600 mb-3" />
              <h4 className="text-sm font-semibold text-slate-300">System is idle</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">There are no ongoing customer support sessions across any support agents.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Agent Owner</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Created Time</th>
                    <th className="px-6 py-4">Live Participants</th>
                    <th className="px-6 py-4 text-right">Emergency Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300">
                  {activeSessions.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-100 flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-indigo-950 flex items-center justify-center border border-indigo-950">
                          <User className="h-3.5 w-3.5 text-indigo-400" />
                        </div>
                        <span>{s.agentId?.name || 'Unknown Agent'}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {s.customerName}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-400">
                          {s.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950 border border-indigo-900 text-indigo-300">
                          {s.activeParticipantCount || 0} online
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleForceTerminate(s.token, s.customerName)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/20 border border-rose-900/50 hover:bg-rose-950 hover:border-rose-800 text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer transition-all"
                          title="Terminate session forcefully"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Force End</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-6 w-full text-center text-xs text-slate-600 border-t border-slate-900/60 mt-12">
        <p>© 2026 SupportLens Systems Monitor. Access restricted to authorized personnel.</p>
      </footer>
    </div>
  );
}
