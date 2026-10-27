
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor, MessageCircle, Users, UserRound, Search, Settings, Minus, Square,
  X, Smile, Send, Volume2, VolumeX, Radio, ShieldAlert, UserPlus, LogOut,
  RefreshCw, Wifi, WifiOff, ChevronRight, Globe, Gamepad2, Moon, Heart,
  Bell, UserCheck, Copy, LockKeyhole, Sparkles, Terminal, Coffee
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';

const ROOMS = [
  { id: 'cafe', name: 'Old Internet Café', icon: Coffee, description: 'General chat & nostalgia', color: '#f4d28a' },
  { id: 'gaming', name: 'Gaming Zone', icon: Gamepad2, description: 'Games, memes & internet culture', color: '#a6d7ff' },
  { id: 'late-night', name: 'Late Night Talks', icon: Moon, description: 'Slow conversations after dark', color: '#d7c4ff' },
  { id: 'friendship', name: 'Friendship Corner', icon: Heart, description: 'Meet people, be kind', color: '#ffb7c7' }
];
const EMOJIS = ['🙂','😂','😭','❤️','✨','👀','👍','🎮','☕','🌙','🤝','💿'];
const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const localId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState(() => localStorage.getItem('i2008-nickname') || '');
  const [draftName, setDraftName] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [activeApp, setActiveApp] = useState('messenger');
  const [activeRoom, setActiveRoom] = useState('cafe');
  const [windowMinimized, setWindowMinimized] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [messages, setMessages] = useState({});
  const [dmMessages, setDmMessages] = useState({});
  const [input, setInput] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineIds, setOnlineIds] = useState([]);
  const [soundOn, setSoundOn] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [status, setStatus] = useState('Available');
  const [notice, setNotice] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [randomState, setRandomState] = useState('idle');
  const [randomPartner, setRandomPartner] = useState(null);
  const [randomMessages, setRandomMessages] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPanel, setAuthPanel] = useState('welcome');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [unread, setUnread] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [statusText, setStatusText] = useState('Listening to old internet');
  const [connectionLabel, setConnectionLabel] = useState(isSupabaseConfigured ? 'Connecting…' : 'Local demo mode');
  const endRef = useRef(null);
  const realtimeRef = useRef([]);
  const identity = session?.user?.id || profile?.id || 'guest';

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(''), 3500);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let alive = true;
    (async () => {
      const user = session.user;
      const fallbackName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Internet Friend';
      const { data, error } = await supabase.from('profiles')
        .upsert({ id: user.id, display_name: fallbackName }, { onConflict: 'id' })
        .select().single();
      if (alive) {
        if (error) showNotice(`Profile setup: ${error.message}`);
        setProfile(data || { id: user.id, display_name: fallbackName });
        setNickname(data?.display_name || fallbackName);
        localStorage.setItem('i2008-nickname', data?.display_name || fallbackName);
      }
    })();
    return () => { alive = false; };
  }, [session, showNotice]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConnectionLabel('Local demo mode');
      return;
    }
    if (!session) {
      setConnectionLabel('Sign in to connect');
      return;
    }
    setConnectionLabel('Connecting live…');
    const channel = supabase.channel(`presence:${session.user.id}`, {
      config: { presence: { key: session.user.id } }
    });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const ids = Object.keys(state);
      setOnlineIds(ids);
      setOnlineCount(ids.length);
    }).subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        channel.track({ display_name: nickname || profile?.display_name || 'Internet Friend', status, online_at: new Date().toISOString() });
        setConnectionLabel('Connected');
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        setConnectionLabel('Connection issue');
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [session, nickname, profile, status]);

  useEffect(() => {
    if (!session || !supabase) return;
    let alive = true;
    (async () => {
      const { data: f1 } = await supabase.from('friendships').select('user_a,user_b').or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`);
      const ids = (f1 || []).map(f => f.user_a === session.user.id ? f.user_b : f.user_a);
      if (ids.length) {
        const { data: p } = await supabase.from('profiles').select('id,display_name,mood').in('id', ids);
        if (alive) setFriends(p || []);
      } else if (alive) setFriends([]);
      const { data: req } = await supabase.from('friend_requests')
        .select('id,sender_id,created_at').eq('receiver_id', session.user.id).eq('status', 'pending');
      if (req?.length) {
        const { data: people } = await supabase.from('profiles').select('id,display_name').in('id', req.map(r => r.sender_id));
        if (alive) setFriendRequests(req.map(r => ({ ...r, person: people?.find(p => p.id === r.sender_id) })));
      } else if (alive) setFriendRequests([]);
    })();
    return () => { alive = false; };
  }, [session, notice]);

  const roomMessages = messages[activeRoom] || [];
  const pushMessage = useCallback((room, message) => {
    setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), message].slice(-300) }));
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    let alive = true;
    const room = activeRoom;
    (async () => {
      const { data, error } = await supabase.from('messages').select('id,room_id,sender_id,body,created_at')
        .eq('room_id', room).order('created_at', { ascending: true }).limit(100);
      if (alive && !error) {
        const ids = [...new Set((data || []).map(m => m.sender_id))];
        const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name').in('id', ids) : { data: [] };
        const mapped = (data || []).map(m => ({
          id: m.id, room: m.room_id, senderId: m.sender_id,
          name: people?.find(p => p.id === m.sender_id)?.display_name || 'Internet Friend',
          body: m.body, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mine: m.sender_id === session.user.id
        }));
        setMessages(prev => ({ ...prev, [room]: mapped }));
      }
    })();
    const channel = supabase.channel(`room:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room}` }, async (payload) => {
        const m = payload.new;
        if (!alive || m.sender_id === session.user.id) return;
        const { data: person } = await supabase.from('profiles').select('display_name').eq('id', m.sender_id).maybeSingle();
        pushMessage(room, { id: m.id, room, senderId: m.sender_id, name: person?.display_name || 'Internet Friend', body: m.body, time: nowTime(), mine: false });
        setUnread(prev => ({ ...prev, [room]: (prev[room] || 0) + (document.hidden ? 1 : 0) }));
      }).subscribe();
    realtimeRef.current.push(channel);
    return () => { alive = false; supabase.removeChannel(channel); realtimeRef.current = realtimeRef.current.filter(c => c !== channel); };
  }, [session, activeRoom, pushMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnread(prev => ({ ...prev, [activeRoom]: 0 }));
  }, [roomMessages.length, activeRoom, activeApp]);

  const ensureIdentity = () => {
    if (!nickname.trim()) {
      setDraftName('');
      setAuthPanel('guest');
      return false;
    }
    return true;
  };

  const enterGuest = () => {
    const name = (draftName || nickname || 'InternetGuest').trim().slice(0, 24);
    if (!name) return showNotice('Choose a nickname first.');
    setNickname(name);
    localStorage.setItem('i2008-nickname', name);
    setProfile({ id: `guest-${localId()}`, display_name: name });
    setGuestMode(true);
    setAuthPanel('welcome');
    showNotice(`Welcome back to 2008, ${name}!`);
  };

  const sendRoomMessage = async (event) => {
    event?.preventDefault();
    const body = input.trim();
    if (!body) return;
    if (body.length > 1000) return showNotice('Message is too long (max 1000 characters).');
    if (session && supabase) {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: session.user.id, room_id: activeRoom, body
      }).select('id,created_at').single();
      if (error) return showNotice(`Message not sent: ${error.message}`);
      pushMessage(activeRoom, { id: data.id, room: activeRoom, senderId: session.user.id, name: nickname || profile?.display_name || 'You', body, time: nowTime(), mine: true });
    } else {
      pushMessage(activeRoom, { id: localId(), room: activeRoom, senderId: identity, name: nickname || 'You', body, time: nowTime(), mine: true });
      showNotice('Local demo: sign in and connect Supabase for real shared chat.');
    }
    setInput('');
    setShowEmoji(false);
    if (soundOn) playPing();
  };

  const playPing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.09);
      oscillator.onended = () => ctx.close();
    } catch {}
  };

  const signIn = async (event, mode) => {
    event.preventDefault();
    setAuthBusy(true); setAuthError('');
    if (!supabase) {
      setAuthError('Supabase is not configured yet. Follow SETUP.md, or use Guest mode to explore the UI.');
      setAuthBusy(false); return;
    }
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail, password: authPassword,
          options: { data: { display_name: (draftName || authEmail.split('@')[0]).slice(0, 24) } }
        });
        if (error) throw error;
        if (!data.session) setAuthError('Check your email for the confirmation link, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err) { setAuthError(err.message || 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  };
}

export default App;
