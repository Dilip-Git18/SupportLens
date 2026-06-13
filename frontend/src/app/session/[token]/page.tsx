'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, 
  Send, Paperclip, Clipboard, Star, Settings, UserCheck, 
  FileText, ShieldCheck, Download, AlertTriangle, AlertCircle, RefreshCcw
} from 'lucide-react';
import { api, getAuthToken, getCurrentUser } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function SessionRoom({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { token } = React.use(params);

  // Connection & Room Status
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<'agent' | 'customer' | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [tempDisconnectMsg, setTempDisconnectMsg] = useState<string | null>(null);
  const [gracePeriodSec, setGracePeriodSec] = useState<number>(10);

  // Media States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(true);
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  
  // Chat States
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Agent Specific Tools
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Technical Support');
  const [savingNotes, setSavingNotes] = useState(false);

  // Customer Feedback Modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // References
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const videoProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const audioProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Verify invitation on load
  useEffect(() => {
    const verify = async () => {
      try {
        const data = await api.verifySession(token);
        setSession(data.session);
        setCategory(data.session.category);
        setNotes(data.session.notes || '');

        // Determine if logged-in user is the agent of this session
        const agentUser = getCurrentUser();
        const agentToken = getAuthToken();
        if (agentToken && agentUser && data.session.agentId._id === agentUser.id) {
          setRole('agent');
          setParticipantName(agentUser.name);
          setIsJoined(false); // Wait for join screen confirmation
        } else {
          setRole('customer');
        }
      } catch (err: any) {
        toast('Session Verification Failed', err.message || 'Invite is invalid or expired.', 'error');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token, router]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Countdown timer for temporary disconnection warning
  useEffect(() => {
    if (tempDisconnectMsg) {
      setGracePeriodSec(10);
      countdownIntervalRef.current = setInterval(() => {
        setGracePeriodSec((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [tempDisconnectMsg]);

  // Attach local stream to video element when it mounts
  useEffect(() => {
    if (isJoined && localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [isJoined, localStream]);

  // Attach remote stream to video element when it mounts
  useEffect(() => {
    if (isJoined && remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [isJoined, remoteStream]);

  // 2. Initialize Call Setup on User Action
  const handleJoinCall = async () => {
    if (!participantName.trim()) {
      toast('Required', 'Please enter your name.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Access camera and microphone
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (mediaErr) {
        console.error('Camera/Mic permission denied:', mediaErr);
        toast('Media Permission Error', 'Could not open camera or mic. Joining audio-only or screen-only is not supported.', 'warning');
      }

      // Initialize Socket.IO connection
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const socketUrl = apiBaseUrl.replace(/\/api$/, '');
      const socket = io(socketUrl);
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnStatus('connected');
        setTempDisconnectMsg(null);
      });

      socket.on('disconnect', () => {
        setConnStatus('disconnected');
      });

      // Handle Reconnection alerts
      socket.on('participant-disconnected-temporary', (data: { role: string; name: string }) => {
        setTempDisconnectMsg(`${data.name} (${data.role}) connection unstable. Reconnecting...`);
      });

      socket.on('participant-joined', (data: { role: string; name: string }) => {
        setTempDisconnectMsg(null);
        toast('Peer Connected', `${data.name} has joined the call.`, 'success');
      });

      socket.on('participant-left', (data: { role: string; name: string }) => {
        setTempDisconnectMsg(null);
        toast('Peer Left', `${data.name} has left the call.`, 'info');
        setRemoteStream(null);
      });

      // Handle custom media toggle notifications
      socket.on('media-toggled', (data: { role: string; kind: string; enabled: boolean }) => {
        if (data.kind === 'video') setRemoteCamOn(data.enabled);
        if (data.kind === 'audio') setRemoteMicOn(data.enabled);
      });

      // Handle live messages
      socket.on('new-message', (msg: any) => {
        setMessages((prev) => [...prev, msg]);
      });

      // Handle session ended forcefully
      socket.on('session-ended', () => {
        toast('Session Finished', 'The host has ended this support session.', 'info');
        cleanupWebRTC();
        if (role === 'customer') {
          setShowFeedbackModal(true);
        } else {
          router.push('/dashboard');
        }
      });

      // Join room signaling
      socket.emit('join-session', { token, role, name: participantName }, async (response: any) => {
        if (response.error) {
          toast('Join Error', response.error, 'error');
          cleanupWebRTC();
          setLoading(false);
          return;
        }

        setIsJoined(true);
        setLoading(false);

        // Bootstrap Mediasoup Client
        try {
          const device = new mediasoupClient.Device();
          deviceRef.current = device;

          await device.load({ routerRtpCapabilities: response.rtpCapabilities });

          // Setup WebRTC Transports
          await setupSendTransport(device, stream);
          await setupRecvTransport(device);

          // Handle already existing producers in room
          if (response.existingProducers && response.existingProducers.length > 0) {
            response.existingProducers.forEach((p: any) => {
              consumeProducer(p.id);
            });
          }

          // Listen for new producers arriving
          socket.on('new-producer', (data: { producerId: string }) => {
            consumeProducer(data.producerId);
          });

          // Listen for producers closing
          socket.on('producer-closed', (data: { producerId: string }) => {
            // Remove remote track or handle clean close
            console.log(`Producer closed: ${data.producerId}`);
          });

        } catch (err: any) {
          console.error('Mediasoup client init failed:', err);
          toast('WebRTC SFU Error', 'Could not initialize media connection.', 'error');
        }
      });

    } catch (err: any) {
      console.error('Join call failed:', err);
      toast('Initialization Error', 'Unable to join call.', 'error');
      setLoading(false);
    }
  };

  // 3. WebRTC Transports Initialization
  const setupSendTransport = async (device: mediasoupClient.Device, stream: MediaStream | null) => {
    if (!socketRef.current) return;

    socketRef.current.emit('create-webrtc-transport', {}, async (transportResponse: any) => {
      if (transportResponse.error) {
        console.error(transportResponse.error);
        return;
      }

      const transport = device.createSendTransport(transportResponse.params);
      sendTransportRef.current = transport;

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socketRef.current?.emit('connect-webrtc-transport', {
          transportId: transport.id,
          dtlsParameters,
        }, (res: any) => {
          if (res.error) errback(res.error);
          else callback();
        });
      });

      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        socketRef.current?.emit('produce', {
          transportId: transport.id,
          kind,
          rtpParameters,
        }, (res: any) => {
          if (res.error) errback(res.error);
          else callback({ id: res.id });
        });
      });

      // Start producing tracks
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
          videoProducerRef.current = await transport.produce({ track: videoTrack });
        }
        if (audioTrack) {
          audioProducerRef.current = await transport.produce({ track: audioTrack });
        }
      }
    });
  };

  const setupRecvTransport = async (device: mediasoupClient.Device) => {
    if (!socketRef.current) return;

    socketRef.current.emit('create-webrtc-transport', {}, async (transportResponse: any) => {
      if (transportResponse.error) {
        console.error(transportResponse.error);
        return;
      }

      const transport = device.createRecvTransport(transportResponse.params);
      recvTransportRef.current = transport;

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socketRef.current?.emit('connect-webrtc-transport', {
          transportId: transport.id,
          dtlsParameters,
        }, (res: any) => {
          if (res.error) errback(res.error);
          else callback();
        });
      });
    });
  };

  const consumeProducer = async (producerId: string) => {
    const socket = socketRef.current;
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;

    if (!socket || !device || !recvTransport) return;

    socket.emit('consume', {
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    }, async (consumeResponse: any) => {
      if (consumeResponse.error) {
        console.error('Consume response error:', consumeResponse.error);
        return;
      }

      try {
        const consumer = await recvTransport.consume(consumeResponse.params);
        
        socket.emit('resume-consumer', { consumerId: consumer.id }, () => {
          // Add consumer track to remote stream
          const trackStream = new MediaStream([consumer.track]);
          setRemoteStream(trackStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = trackStream;
          }
        });

      } catch (err) {
        console.error('Failed to consume track:', err);
      }
    });
  };

  // 4. Media Controls Toggles
  const toggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const targetState = !isCamOn;
      videoTrack.enabled = targetState;
      setIsCamOn(targetState);
      
      socketRef.current?.emit('toggle-media', { kind: 'video', enabled: targetState });
    }
  };

  const toggleMicrophone = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const targetState = !isMicOn;
      audioTrack.enabled = targetState;
      setIsMicOn(targetState);

      socketRef.current?.emit('toggle-media', { kind: 'audio', enabled: targetState });
    }
  };

  // 5. Chat Messaging & Upload Actions
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;

    socketRef.current.emit('send-message', { content: chatInput }, (res: any) => {
      if (res.success) {
        setChatInput('');
      } else {
        toast('Message failed', 'Could not deliver chat message.', 'error');
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socketRef.current) return;

    setUploadingFile(true);
    try {
      const res = await api.uploadFile(file);
      socketRef.current.emit('send-message', {
        fileUrl: res.fileUrl,
        fileName: res.fileName,
        fileType: res.fileType,
      });
      toast('File Sent', `${file.name} uploaded successfully.`, 'success');
    } catch (err: any) {
      toast('Upload Failed', err.message || 'File upload error.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // 6. Agent Tool Panel Update Actions
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updateSessionNotes(token, { notes, category });
      toast('Notes Saved', 'Support notes synchronized successfully.', 'success');
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to sync notes.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleEndCall = () => {
    if (!confirm('Are you sure you want to end the support session for both participants?')) return;
    socketRef.current?.emit('end-session', (res: any) => {
      if (res.success) {
        router.push('/dashboard');
      } else {
        toast('Action failed', res.error, 'error');
      }
    });
  };

  // 7. Customer Rating submit
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      await api.submitRating(token, { rating, ratingFeedback });
      toast('Thank You!', 'Feedback submitted successfully.', 'success');
      router.push(`/session/${token}/ended`);
    } catch (err: any) {
      toast('Submission Failed', err.message || 'Error saving feedback.', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // 8. Connections Clean Up
  const cleanupWebRTC = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    remoteStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStream(null);

    videoProducerRef.current?.close();
    audioProducerRef.current?.close();
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsJoined(false);
  };

  // Cleanup effect on unmount
  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b11] flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Establishing secure media handshakes...</p>
      </div>
    );
  }

  // A. PRE-JOIN screen
  if (!isJoined) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#090b11] overflow-hidden p-6">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/15 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-950/70 p-8 shadow-2xl glass-panel relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Secure Live Support</h2>
            <p className="text-xs text-slate-400 mt-2 px-6">
              You are joining support session for category <span className="text-indigo-400 font-semibold">{session?.category}</span>.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {role === 'agent' ? 'Confirm Agent Name' : 'Your Name'}
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder={role === 'agent' ? 'Agent Name' : 'Enter your name...'}
                disabled={role === 'agent'}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75"
              />
            </div>

            <button
              onClick={handleJoinCall}
              className="w-full py-3 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              Start Live Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // B. MAIN CALL ROOM SCREEN
  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col text-slate-100 overflow-hidden h-screen">
      {/* Upper header */}
      <header className="border-b border-slate-900 bg-slate-950/60 px-6 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-indigo-950 flex items-center justify-center border border-indigo-900">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-none">{session?.customerName} Support Room</h3>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mt-1">
              Category: {category}
            </p>
          </div>
        </div>

        {/* Temporary connection loss warning */}
        {tempDisconnectMsg && (
          <div className="animate-pulse flex items-center gap-2 bg-amber-950/40 border border-amber-950 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-amber-400 leading-none">
              {tempDisconnectMsg} ({gracePeriodSec}s)
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/20 border border-emerald-900 text-emerald-400 capitalize">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {role} Console
          </span>
        </div>
      </header>

      {/* Grid: Media Box + Right Panels */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Video Container */}
        <div className="flex-1 flex flex-col bg-[#0b0e17] relative p-4 justify-center items-center">
          
          {/* Video Feeds Grid */}
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 max-w-4xl max-h-[80vh]">
            
            {/* Remote Feed (Main Container) */}
            <div className="relative w-full h-full rounded-xl bg-slate-950 border border-slate-900 overflow-hidden flex items-center justify-center group">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${remoteCamOn ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : null}

              {/* Remote Cam/Mic Muted Status Overlays */}
              {(!remoteStream || !remoteCamOn) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 space-y-2">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-slate-500" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {remoteStream ? 'Camera is Disabled' : 'Waiting for connection...'}
                  </p>
                </div>
              )}

              {/* Remote overlay bar */}
              <div className="absolute bottom-3 left-3 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <span>{role === 'agent' ? 'Customer' : 'Support Agent'}</span>
                {!remoteMicOn && <MicOff className="h-3 w-3 text-rose-400 shrink-0" />}
              </div>
            </div>

            {/* Local Feed (Miniature Picture-in-Picture) */}
            <div className="absolute top-4 right-4 w-32 sm:w-44 h-24 sm:h-32 rounded-lg bg-slate-950 border border-indigo-500/20 overflow-hidden shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${isCamOn ? 'opacity-100' : 'opacity-0'}`}
              />
              {!isCamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-600">
                  <VideoOff className="h-5 w-5" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-[4px] text-[10px] font-semibold flex items-center gap-1">
                <span>You</span>
                {!isMicOn && <MicOff className="h-2.5 w-2.5 text-rose-400" />}
              </div>
            </div>

          </div>

          {/* Video Control Bar */}
          <div className="mt-4 shrink-0 flex items-center gap-3 py-3 px-6 rounded-2xl bg-slate-950 border border-slate-900 shadow-2xl">
            <button
              onClick={toggleMicrophone}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isMicOn ? 'bg-slate-900 text-slate-200 hover:bg-slate-800' : 'bg-rose-950/60 border border-rose-900 text-rose-400'
              }`}
              title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isCamOn ? 'bg-slate-900 text-slate-200 hover:bg-slate-800' : 'bg-rose-950/60 border border-rose-900 text-rose-400'
              }`}
              title={isCamOn ? 'Disable Camera' : 'Enable Camera'}
            >
              {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>

            {role === 'agent' ? (
              <button
                onClick={handleEndCall}
                className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer flex items-center gap-1 px-4 font-semibold text-xs"
                title="End support call"
              >
                <PhoneOff className="h-4 w-4" />
                <span className="hidden sm:inline">End Support</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (confirm('Disconnect from this support session?')) {
                    cleanupWebRTC();
                    setShowFeedbackModal(true);
                  }
                }}
                className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer flex items-center gap-1 px-4 font-semibold text-xs"
                title="Disconnect call"
              >
                <PhoneOff className="h-4 w-4" />
                <span className="hidden sm:inline">Leave Session</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Side: Chat Panel & Agent Tools */}
        <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-slate-900 bg-[#090b11] flex flex-col shrink-0">
          
          {/* Scrollable Panel content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Agent Control tools (Agent only) */}
            {role === 'agent' && (
              <div className="p-4 border-b border-slate-900 bg-[#0c0f1a] space-y-3 shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span>Agent Assistance Panel</span>
                </h4>
                
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Session Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing & Invoicing">Billing & Invoicing</option>
                    <option value="Account Access">Account Access</option>
                    <option value="Product Onboarding">Product Onboarding</option>
                    <option value="General Inquiry">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Live Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Write session troubleshooting details here..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                  />
                </div>

                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingNotes ? 'Syncing...' : 'Save Notes & Tag'}
                </button>
              </div>
            )}

            {/* Chat Messages Log */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 bg-[#0a0d17]/40 border-b border-slate-900 shrink-0 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Session Messaging</span>
                </span>
                <span className="text-[10px] text-slate-500">{messages.length} messages</span>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-600">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-55" />
                    <p className="text-xs italic">Chat room is secure and active.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m._id} className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[11px] font-bold ${
                          m.senderRole === 'agent' ? 'text-indigo-400' : 'text-slate-300'
                        }`}>
                          {m.senderName}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {/* Message Content or File link */}
                      {m.fileUrl ? (
                        <div className="mt-1 flex items-start gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 max-w-[85%]">
                          <Download className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div className="overflow-hidden">
                            <a
                              href={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '')}${m.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-indigo-300 hover:underline truncate block"
                            >
                              {m.fileName}
                            </a>
                            <span className="text-[9px] text-slate-500 block uppercase">
                              {m.fileType?.split('/')[1] || 'document'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap max-w-[90%]">
                          {m.content}
                        </p>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input form */}
              <div className="p-3 border-t border-slate-900 bg-slate-950/60 shrink-0 flex items-center gap-2">
                <label
                  className={`p-2 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0 relative ${
                    uploadingFile ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  title="Upload attachment (PDF, Images)"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                  {uploadingFile && (
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/70 rounded-lg">
                      <span className="h-3 w-3 border-2 border-indigo-500/35 border-t-indigo-500 rounded-full animate-spin" />
                    </span>
                  )}
                </label>

                <form onSubmit={handleSendMessage} className="flex-1 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* CUSTOMER FEEDBACK MODAL */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#090b12] p-6 shadow-2xl glass-panel text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-950/40 border border-emerald-900 flex items-center justify-center text-emerald-400 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-100">Support Session Completed</h3>
            <p className="text-xs text-slate-400 mt-1">Please rate your customer support experience to help us improve.</p>

            <form onSubmit={handleFeedbackSubmit} className="mt-6 space-y-5">
              {/* Star Rating Select */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
                  Comments / Feedback (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  placeholder="Share details about your experience..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingFeedback}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-50"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
