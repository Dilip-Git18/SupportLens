'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, LogOut, Plus, RefreshCw, Star, 
  Clock, CheckCircle2, User, Eye, Search, AlertCircle, FileText, ExternalLink, ShieldAlert
} from 'lucide-react';
import { api, getAuthToken, setAuthToken, getCurrentUser } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [agentName, setAgentName] = useState('Agent');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  
  // Create Session Dialog
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCategory, setNewCategory] = useState('Technical Support');
  const [createdSessionData, setCreatedSessionData] = useState<{
    session: any;
    inviteUrl: string;
    qrCodeUrl: string;
  } | null>(null);

  // History Details Drawer Modal
  const [selectedHistorySession, setSelectedHistorySession] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<{
    session: any;
    participants: any[];
    messages: any[];
    events: any[];
  } | null>(null);

  // Check auth
  useEffect(() => {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (!token || !user) {
      router.push('/');
    } else {
      setAgentName(user.name);
      loadDashboardData();
    }
  }, [router]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const active = await api.getActiveSessions();
      const history = await api.getSessionHistory();
      setActiveSessions(active);
      setSessionHistory(history);
    } catch (err: any) {
      toast('Failed to load sessions', err.message || 'Error communicating with server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    toast('Logged Out', 'You have been successfully logged out.', 'info');
    router.push('/');
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      toast('Invalid Name', 'Please input a valid customer name.', 'warning');
      return;
    }

    setCreateLoading(true);
    try {
      const data = await api.createSession({
        customerName: newCustomerName,
        category: newCategory
      });
      setCreatedSessionData(data);
      toast('Session Created!', `Support link and QR code generated for ${newCustomerName}`, 'success');
      loadDashboardData(); // Reload list
    } catch (err: any) {
      toast('Creation Failed', err.message || 'Unable to create session.', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEndSession = async (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to terminate this active support session?')) return;
    
    try {
      await api.endSession(token);
      toast('Session Ended', 'The session has been terminated.', 'success');
      loadDashboardData();
    } catch (err: any) {
      toast('Action Failed', err.message || 'Unable to end session.', 'error');
    }
  };

  const handleViewDetails = async (session: any) => {
    setSelectedHistorySession(session);
    setDetailsLoading(true);
    setSessionDetails(null);
    try {
      const details = await api.getSessionDetails(session.token);
      setSessionDetails(details);
    } catch (err: any) {
      toast('Failed to load transcript', err.message || 'Error fetching chat and history.', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Copied', 'Invite link copied to clipboard.', 'success');
  };

  // Helper formats
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const filteredHistory = sessionHistory.filter(s => 
    s.customerName.toLowerCase().includes(historySearch.toLowerCase()) ||
    s.category.toLowerCase().includes(historySearch.toLowerCase())
  );

  // Dashboard Stats Calculations
  const totalCalls = sessionHistory.length + activeSessions.length;
  const activeCount = activeSessions.length;
  const avgRating = sessionHistory.filter(s => s.rating).length > 0
    ? (sessionHistory.reduce((acc, curr) => acc + (curr.rating || 0), 0) / sessionHistory.filter(s => s.rating).length).toFixed(1)
    : 'N/A';
  const totalDurationSeconds = sessionHistory.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  return (
    <div className="min-h-screen bg-[#090b11] flex flex-col">
      {/* Header NavBar */}
      <header className="border-b border-slate-900 bg-slate-950/60 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-slate-100">SupportLens</h1>
              <p className="text-[9px] uppercase tracking-widest text-indigo-400 font-semibold leading-none">Agent Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 bg-amber-950/20 border border-amber-950/60 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Admin View</span>
            </button>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <div className="h-7 w-7 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-300" />
              </div>
              <span className="text-xs font-medium text-slate-300 hidden sm:inline">{agentName}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/15 rounded-lg transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1 space-y-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Calls Created</span>
              <FileText className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2">{totalCalls}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Support Sessions</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0 mt-1.5" />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2">{activeCount}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Customer Rating</span>
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2 flex items-baseline gap-1">
              {avgRating} <span className="text-xs font-normal text-slate-500">/ 5.0</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 glass-panel">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Completed Time Sum</span>
              <Clock className="h-4 w-4 text-violet-400" />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2">{formatDuration(totalDurationSeconds)}</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-900 pb-4">
          <div className="flex gap-2 p-0.5 rounded-lg bg-slate-950 border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'active' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Calls ({activeSessions.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Session History ({sessionHistory.length})
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
              title="Refresh lists"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setCreatedSessionData(null);
                setNewCustomerName('');
                setShowCreateModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-white px-4 py-2 text-xs font-semibold hover:bg-indigo-500 transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Create Session</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="h-8 w-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Retrieving support data...</p>
          </div>
        ) : activeTab === 'active' ? (
          /* Active Sessions */
          activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
              <CheckCircle2 className="h-10 w-10 text-slate-600 mb-3" />
              <h4 className="text-sm font-semibold text-slate-300">All caught up!</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">There are no active video support sessions. Create a session to invite a customer.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSessions.map((s) => (
                <div key={s._id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 glass-panel flex flex-col justify-between hover:border-slate-700/60 transition-all">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/20">
                        {s.category}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/20 border border-emerald-950/50 px-2 py-0.5 rounded">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {s.status}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-100 mt-4 flex items-center gap-1.5">
                      <User className="h-4.5 w-4.5 text-slate-400" />
                      <span>{s.customerName}</span>
                    </h4>

                    <div className="text-xs text-slate-400 space-y-1.5 mt-4">
                      <p className="flex justify-between">
                        <span>Created:</span>
                        <span className="font-medium text-slate-300">
                          {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span>Token:</span>
                        <span className="font-mono text-slate-500 select-all">{s.token.substring(0, 8)}...</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <button
                      onClick={() => router.push(`/session/${s.token}`)}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                    >
                      <span>Join Room</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleEndSession(s.token, e)}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-rose-950 hover:border-rose-900 text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
                    >
                      End Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Session History */
          <div>
            {/* Search Filter */}
            <div className="relative max-w-sm mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search history by name or tag..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                <AlertCircle className="h-10 w-10 text-slate-600 mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">No session records</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  {historySearch ? 'No history matching search query.' : 'Completed session histories will appear here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Completed Date</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Rating</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-300">
                    {filteredHistory.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-100 flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-500" />
                          <span>{s.customerName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-400">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {new Date(s.completedAt || s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {formatDuration(s.duration)}
                        </td>
                        <td className="px-6 py-4">
                          {s.rating ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              <span>{s.rating}</span>
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                            </span>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewDetails(s)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 hover:text-slate-100 cursor-pointer transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Transcript</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl glass-panel">
            <h3 className="text-lg font-bold text-slate-100">Create Video Support Session</h3>
            <p className="text-xs text-slate-400 mt-1">Configure details below to generate an invitation for the customer.</p>

            {!createdSessionData ? (
              <form onSubmit={handleCreateSession} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Enter customer name..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Category Tag</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing & Invoicing">Billing & Invoicing</option>
                    <option value="Account Access">Account Access</option>
                    <option value="Product Onboarding">Product Onboarding</option>
                    <option value="General Inquiry">General Inquiry</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex items-center justify-center px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition-colors shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                  >
                    {createLoading ? (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Generate Invitation'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Invitation details view */
              <div className="mt-4 space-y-5 text-center">
                <div className="flex justify-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="bg-white p-2.5 rounded-lg flex items-center justify-center">
                    <img src={createdSessionData.qrCodeUrl} alt="QR Code Invitation" className="h-36 w-36" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed px-4">
                  The customer can scan the QR code using a mobile device, or you can send them the secure link below:
                </p>

                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                  <input
                    type="text"
                    readOnly
                    value={createdSessionData.inviteUrl}
                    className="flex-1 bg-transparent border-none text-[11px] font-mono text-indigo-300 focus:outline-none select-all px-1"
                  />
                  <button
                    onClick={() => copyToClipboard(createdSessionData.inviteUrl)}
                    className="px-3 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Copy
                  </button>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedSessionData(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg cursor-pointer transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SESSION DETAILS / TRANSCRIPT DRAWER */}
      {selectedHistorySession && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl h-full border-l border-slate-800 bg-[#0c0f1b] p-6 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div>
              {/* Drawer Header */}
              <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Session Summary</h3>
                  <p className="text-xs text-indigo-400 font-semibold mt-0.5 uppercase tracking-wide">
                    {selectedHistorySession.category} • {formatDuration(selectedHistorySession.duration)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedHistorySession(null)}
                  className="px-2.5 py-1 text-xs border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="h-6 w-6 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-500">Decrypting chat logs and timeline events...</p>
                </div>
              ) : sessionDetails ? (
                <div className="space-y-6 mt-6">
                  {/* Rating Feedback card */}
                  {sessionDetails.session.rating && (
                    <div className="rounded-lg border border-amber-500/10 bg-amber-950/10 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>Customer Review</span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-2 font-medium">
                        Score: {sessionDetails.session.rating} / 5
                      </p>
                      {sessionDetails.session.ratingFeedback && (
                        <p className="text-xs text-slate-400 italic mt-1 leading-relaxed">
                          "{sessionDetails.session.ratingFeedback}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes Card */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent Session Notes</h4>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">
                      {sessionDetails.session.notes || 'No notes saved for this session.'}
                    </p>
                  </div>

                  {/* Chat logs */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Chat Transcript</h4>
                    {sessionDetails.messages.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 border border-slate-900 rounded-lg bg-slate-950/10">No messages sent in this session.</p>
                    ) : (
                      <div className="space-y-3 p-3 rounded-lg border border-slate-900 bg-slate-950/30 max-h-56 overflow-y-auto">
                        {sessionDetails.messages.map((m: any) => (
                          <div key={m._id} className="text-xs leading-relaxed">
                            <span className="text-[10px] text-slate-500 mr-1.5">
                              [{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                            </span>
                            <span className={`font-semibold ${m.senderRole === 'agent' ? 'text-indigo-400' : 'text-slate-300'}`}>
                              {m.senderName}:
                            </span>{' '}
                            {m.fileUrl ? (
                              <a
                                href={`http://localhost:5000${m.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:underline font-semibold"
                              >
                                [Shared File: {m.fileName}]
                              </a>
                            ) : (
                              <span className="text-slate-300">{m.content}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Session Event Logs */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Timeline Events</h4>
                    <div className="space-y-2.5 p-3 rounded-lg border border-slate-900 bg-slate-950/30 max-h-52 overflow-y-auto">
                      {sessionDetails.events.map((e: any) => (
                        <div key={e._id} className="text-[11px] leading-normal flex items-start gap-1 text-slate-400">
                          <span className="text-[10px] text-slate-600 mt-0.5 shrink-0">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
                          </span>
                          <span>{e.details}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-900 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedHistorySession(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer transition-colors"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
