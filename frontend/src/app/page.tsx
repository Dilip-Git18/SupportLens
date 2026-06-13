'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Video, MessageSquare, Database, BarChart3, HelpCircle, ArrowRight } from 'lucide-react';
import { api, getAuthToken } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Redirect if already logged in
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || (!isLogin && !formData.name)) {
      toast('Required Fields', 'Please fill in all required fields.', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await api.login({ email: formData.email, password: formData.password });
        toast('Welcome back!', 'Agent login successful.', 'success');
      } else {
        await api.register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        toast('Account Created!', 'Agent registration completed.', 'success');
      }
      router.push('/dashboard');
    } catch (err: any) {
      toast('Authentication Failed', err.message || 'Check your credentials and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#090b11]">
      {/* Decorative Gradient Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/15 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              SupportLens
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold leading-none">
              WebRTC SFU Support
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500 font-medium px-3 py-1 rounded-full border border-slate-800 bg-slate-900/40">
          v1.0.0 Stable
        </span>
      </header>

      {/* Hero & Login Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Side: SaaS Presentation */}
        <div className="lg:col-span-7 flex flex-col justify-center gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs text-indigo-300 font-medium">AtomQuest Hackathon Submission</span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
            Secure, Self-Hosted <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent">
              Video Support Session
            </span>
          </h2>
          
          <p className="text-slate-400 text-lg max-w-xl leading-relaxed">
            SupportLens empowers agents to launch private video calls and in-call messaging directly in the browser. Powered by a self-hosted Mediasoup SFU media server for maximum compliance.
          </p>

          {/* Core Features list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <Video className="h-5 w-5 text-indigo-400 mt-1 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">1-on-1 Video & Audio</h4>
                <p className="text-xs text-slate-400 mt-0.5">High quality WebRTC media streams.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <MessageSquare className="h-5 w-5 text-indigo-400 mt-1 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Real-time Chat & Files</h4>
                <p className="text-xs text-slate-400 mt-0.5">Share chat messages and PDF/image uploads.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <Database className="h-5 w-5 text-indigo-400 mt-1 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Persistent History</h4>
                <p className="text-xs text-slate-400 mt-0.5">MongoDB tracking of chat logs & metrics.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/20 border border-slate-800/40">
              <ShieldCheck className="h-5 w-5 text-indigo-400 mt-1 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Token-Based Invitations</h4>
                <p className="text-xs text-slate-400 mt-0.5">Generate secure links or QR codes for joins.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-5 flex justify-center w-full">
          <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-950/60 p-8 shadow-2xl backdrop-blur-xl glass-panel relative">
            <h3 className="text-2xl font-bold text-slate-100">
              {isLogin ? 'Agent Portal Login' : 'Create Agent Account'}
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              {isLogin ? 'Enter your agent credentials to access dashboard.' : 'Sign up to start hosting support sessions.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Agent Smith"
                    required={!isLogin}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="agent@supportlens.com"
                  required
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20 mt-6"
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Login to Dashboard' : 'Complete Registration'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs">
              <span className="text-slate-400">
                {isLogin ? "Don't have an agent account?" : "Already have an agent account?"}
              </span>{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ name: '', email: '', password: '' });
                }}
                className="text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-6 w-full text-center text-xs text-slate-500 border-t border-slate-900 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© 2026 SupportLens. Developed for the AtomQuest Hackathon.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Compliant SFU</span>
          <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5 text-indigo-400" /> MongoDB Atlas</span>
        </div>
      </footer>
    </div>
  );
}
