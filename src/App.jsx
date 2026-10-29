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
const DAILY_PROMPTS = [
  'What tiny thing made your day better?',
  'Which song feels like a memory?',
  'What would you tell your 13-year-old self?',
  'What is a harmless opinion you will defend forever?',
  'What was your favourite corner of the old internet?',
  'If tonight had a soundtrack, what would track one be?',
  'What is something you wish people asked you more often?',
  'Which fictional world would you visit for one afternoon?',
  'What is a small win you are proud of lately?',
  'What is a memory that still makes you smile?',
  'What is one thing you want to learn this year?',
  'What is your comfort game, show, or movie?',
  'What would your perfect no-plans day look like?',
  'What is a green flag in a friendship?'
];
const dayStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const dailyPrompt = DAILY_PROMPTS[Number(dayStamp) % DAILY_PROMPTS.length];
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
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [dmBusy, setDmBusy] = useState(false);
  const [input, setInput] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
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
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchBusy, setFriendSearchBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPanel, setAuthPanel] = useState('welcome');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [unread, setUnread] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [statusText, setStatusText] = useState('Listening to old internet');
  const [connectionLabel, setConnectionLabel] = useState(isSupabaseConfigured ? 'Connecting…' : 'Local demo mode');
  const endRef = useRef(null);
  const roomComposerRef = useRef(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const randomRequestRef = useRef(0);
  const randomLeaveRef = useRef(Promise.resolve());
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
      try {
        // Read first instead of upserting on every login: an upsert would overwrite
        // a display name or mood the user deliberately saved on their profile.
        const { data: existing, error: lookupError } = await supabase.from('profiles')
          .select('id,display_name,mood').eq('id', user.id).maybeSingle();
        if (lookupError) throw lookupError;
        let data = existing;
        if (!data) {
          const { error: insertError } = await supabase.from('profiles')
            .insert({ id: user.id, display_name: fallbackName });
          if (insertError && insertError.code !== '23505') throw insertError;
          const { data: created, error: fetchError } = await supabase.from('profiles')
            .select('id,display_name,mood').eq('id', user.id).single();
          if (fetchError) throw fetchError;
          data = created;
        }
        if (!alive) return;
        const savedName = data.display_name || fallbackName;
        setProfile(data);
        setNickname(savedName);
        setStatusText(data.mood || 'Listening to old internet');
        localStorage.setItem('i2008-nickname', savedName);
      } catch (error) {
        if (!alive) return;
        showNotice(`Profile setup: ${error.message}`);
        setProfile({ id: user.id, display_name: fallbackName });
        setNickname(fallbackName);
        localStorage.setItem('i2008-nickname', fallbackName);
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
      setConnectionLabel('Enter your name to connect');
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

  useEffect(() => {
    if (activeApp !== 'profile' || !session || !supabase) {
      setBlockedUsers([]);
      setBlockedLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setBlockedLoading(true);
      try {
        const { data: blocks, error } = await supabase.from('blocks')
          .select('blocked_id').eq('blocker_id', session.user.id);
        if (error) throw error;
        const ids = (blocks || []).map(block => block.blocked_id);
        if (!ids.length) {
          if (alive) setBlockedUsers([]);
          return;
        }
        const { data: people, error: peopleError } = await supabase.from('profiles')
          .select('id,display_name').in('id', ids);
        if (peopleError) throw peopleError;
        if (alive) setBlockedUsers(people || []);
      } catch (error) {
        if (alive) showNotice(`Could not load blocked users: ${error.message}`);
      } finally {
        if (alive) setBlockedLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeApp, session, showNotice]);

  useEffect(() => {
    const target = friendSearch.trim();
    if (!session || !supabase || target.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      return;
    }
    setFriendSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target);
        let query = supabase.from('profiles').select('id,display_name,mood').neq('id', session.user.id).limit(10);
        query = isUuid ? query.eq('id', target) : query.ilike('display_name', '%' + target + '%');
        const { data, error } = await query;
        if (error) throw error;
        setFriendSearchResults(data || []);
      } catch (error) {
        setFriendSearchResults([]);
        showNotice('Friend search failed: ' + error.message);
      } finally {
        setFriendSearchLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [friendSearch, session, showNotice]);

  const sendFriendRequestTo = async (person) => {
    if (!session || !supabase) return showNotice('Sign in to add permanent friends.');
    if (!person?.id) return showNotice('That profile could not be selected.');
    setFriendSearchBusy(true);
    try {
      const { error } = await supabase.rpc('send_friend_request', { p_receiver_id: person.id });
      if (error) throw error;
      setFriendSearch('');
      setFriendSearchResults([]);
      showNotice('Friend request sent to ' + (person.display_name || 'your friend') + '.');
    } catch (error) {
      showNotice('Friend request failed: ' + error.message);
    } finally {
      setFriendSearchBusy(false);
    }
  };

  const roomMessages = messages[activeRoom] || [];
  const pushMessage = useCallback((room, message) => {
    setMessages(prev => {
      const current = prev[room] || [];
      // History and Realtime can deliver the same row; keep each database message once.
      if (current.some(existing => existing.id === message.id)) return prev;
      return { ...prev, [room]: [...current, message].slice(-300) };
    });
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    let alive = true;
    const room = activeRoom;
    (async () => {
      const { data, error } = await supabase.from('messages').select('id,room_id,sender_id,body,created_at')
        .eq('room_id', room).order('created_at', { ascending: true }).limit(100);
      if (!alive) return;
      if (error) {
        showNotice(`Could not load ${room} messages: ${error.message}`);
        return;
      }
      const ids = [...new Set((data || []).map(m => m.sender_id))];
      const { data: people, error: peopleError } = ids.length
        ? await supabase.from('profiles').select('id,display_name').in('id', ids)
        : { data: [], error: null };
      if (!alive) return;
      if (peopleError) showNotice(`Some sender names could not load: ${peopleError.message}`);
      const mapped = (data || []).map(m => ({
        id: m.id, room: m.room_id, senderId: m.sender_id, created_at: m.created_at,
        name: people?.find(p => p.id === m.sender_id)?.display_name || 'Internet Friend',
        body: m.body, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mine: m.sender_id === session.user.id
      }));
      // Merge history with any realtime messages received while the initial query was in flight.
      setMessages(prev => {
        const existing = prev[room] || [];
        const byId = new Map([...mapped, ...existing].map(message => [message.id, message]));
        return { ...prev, [room]: [...byId.values()].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).slice(-300) };
      });
    })();
    const channel = supabase.channel(`room:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room}` }, async (payload) => {
        const m = payload.new;
        if (!alive || m.sender_id === session.user.id) return;
        const { data: person } = await supabase.from('profiles').select('display_name').eq('id', m.sender_id).maybeSingle();
        pushMessage(room, { id: m.id, room, senderId: m.sender_id, created_at: m.created_at, name: person?.display_name || 'Internet Friend', body: m.body, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mine: false });
        setUnread(prev => ({ ...prev, [room]: (prev[room] || 0) + (document.hidden ? 1 : 0) }));
      }).subscribe((state) => {
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          showNotice(`Live updates for ${room} are unavailable. Check the Supabase Realtime setup.`);
        }
      });
    realtimeRef.current.push(channel);
    return () => { alive = false; supabase.removeChannel(channel); realtimeRef.current = realtimeRef.current.filter(c => c !== channel); };
  }, [session, activeRoom, pushMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnread(prev => ({ ...prev, [activeRoom]: 0 }));
  }, [roomMessages.length, activeRoom, activeApp, activeConversationId, (dmMessages[activeConversationId] || []).length]);

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
    const sendingRoom = activeRoom;
    const sendingUserId = session?.user?.id;
    if (!body) return;
    if (body.length > 1000) return showNotice('Message is too long (max 1000 characters).');
    if (session && supabase) {
      // Anonymous sign-in can finish before the profile upsert effect; ensure the FK target exists before sending.
      const { error: profileError } = await supabase.from('profiles').upsert(
        { id: sendingUserId, display_name: (nickname || profile?.display_name || 'Internet Friend').slice(0, 24) },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (profileError) return showNotice(`Message not sent: profile setup failed: ${profileError.message}`);
      const { data, error } = await supabase.from('messages').insert({
        sender_id: sendingUserId, room_id: sendingRoom, body
      }).select('id,created_at').single();
      if (error) return showNotice(`Message not sent: ${error.message}`);
      pushMessage(sendingRoom, { id: data.id, room: sendingRoom, senderId: sendingUserId, created_at: data.created_at, name: nickname || profile?.display_name || 'You', body, time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mine: true });
    } else {
      pushMessage(sendingRoom, { id: localId(), room: sendingRoom, senderId: identity, name: nickname || 'You', body, time: nowTime(), mine: true });
      showNotice('Local demo: sign in and connect Supabase for real shared chat.');
    }
    // A room switch or new draft while saving must not clear the user's current composer.
    if (activeRoom === sendingRoom && inputRef.current.trim() === body) setInput('');
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

  const signIn = async (event) => {
    event?.preventDefault();
    const name = (draftName || nickname).trim().slice(0, 24);
    if (!name) {
      setAuthError('Please enter your name first.');
      return;
    }
    if (!supabase) {
      // Local-only fallback still lets the UI be explored without a backend.
      setNickname(name);
      localStorage.setItem('i2008-nickname', name);
      setProfile({ id: `guest-${localId()}`, display_name: name });
      setGuestMode(true);
      setShowSettings(false);
      setAuthError('');
      showNotice('Name saved on this device. Live chat needs Supabase configured.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: name } }
      });
      if (error) throw error;
      setNickname(name);
      localStorage.setItem('i2008-nickname', name);
      setShowSettings(false);
      showNotice(`Welcome to Internet 2008, ${name}!`);
    } catch (err) {
      setAuthError(err.message || 'Could not start your chat session.');
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    // Invalidate pending matchmaking responses before leaving so a late RPC cannot
    // restore a match after the user has signed out.
    randomRequestRef.current += 1;
    if (supabase && session) {
      // Close any queued/active random match before ending the authenticated session.
      // Cleanup failure must not prevent the user from signing out.
      try {
        await randomLeaveRef.current;
        const { error: leaveError } = await supabase.rpc('leave_random_match');
        if (leaveError) showNotice(`Random chat cleanup failed: ${leaveError.message}`);
      } catch (error) {
        showNotice(error.message || 'Random chat cleanup failed.');
      }
      await supabase.auth.signOut();
    }
    // Clear user-scoped UI/cache so another person using this browser cannot see
    // the previous account's private conversation after sign-out.
    setSelectedFriend(null); setActiveConversationId(null); setDmMessages({});
    setFriendRequests([]); setFriends([]);
    setRandomState('idle'); setRandomPartner(null); setMatchId(null); setRandomMessages([]);
    setSession(null); setProfile(null); setGuestMode(false); setNickname('');
    localStorage.removeItem('i2008-nickname');
    setAuthPanel('welcome'); showNotice('Signed out.');
  };

  const startRandomChat = async () => {
    if (!session) {
      setRandomState('login');
      showNotice('Enter your name first to use random matching.');
      return;
    }
    const requestId = ++randomRequestRef.current;
    // Finish leaving the previous match before exposing the searching state; otherwise
    // the polling effect could reconnect to the old match while leave is still in flight.
    await randomLeaveRef.current;
    if (requestId !== randomRequestRef.current) return;
    setRandomState('searching'); setRandomPartner(null); setMatchId(null); setRandomMessages([]);
    const { data, error } = await supabase.rpc('find_random_match');
    // Ignore a late response if the user cancelled or started another search.
    if (requestId !== randomRequestRef.current) return;
    if (error) {
      // Recover a match left active by a refresh or a previous interrupted request.
      const { data: activeMatch } = await supabase.from('random_matches')
        .select('id,user_a,user_b')
        .eq('status', 'active')
        .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
        .limit(1)
        .maybeSingle();
      if (requestId !== randomRequestRef.current) return;
      if (activeMatch) {
        const partnerId = activeMatch.user_a === session.user.id ? activeMatch.user_b : activeMatch.user_a;
        const { data: partner } = await supabase.from('profiles')
          .select('id,display_name').eq('id', partnerId).maybeSingle();
        if (requestId !== randomRequestRef.current) return;
        setRandomState('matched');
        setMatchId(activeMatch.id);
        setRandomPartner({ id: partnerId, name: partner?.display_name || 'Internet Friend' });
        showNotice('Reconnected to your active chat.');
        return;
      }
      setRandomState('idle');
      return showNotice(`Matching unavailable: ${error.message}. Deploy the database SQL first.`);
    }
    if (data?.status === 'matched') {
      setRandomState('matched'); setMatchId(data.match_id);
      setRandomPartner({ id: data.partner_id, name: data.partner_name || 'Internet Friend' });
    } else {
      setRandomState('searching');
      showNotice('You are in the queue. Another available user is needed to match.');
    }
  };

  // A queued user must discover when another user creates their match.
  // The matchmaking RPC removes both users from the queue, so queue polling alone
  // cannot notify the first user; read the participant-visible active match row.
  useEffect(() => {
    if (!session || !supabase || randomState !== 'searching') return;
    let alive = true;
    let checking = false;
    let lastPollErrorAt = 0;
    const checkForMatch = async () => {
      if (!alive || checking) return;
      checking = true;
      try {
        const { data, error } = await supabase.from('random_matches')
          .select('id,user_a,user_b')
          .eq('status', 'active')
          .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!alive || !data) return;
        const partnerId = data.user_a === session.user.id ? data.user_b : data.user_a;
        const { data: partner } = await supabase.from('profiles')
          .select('id,display_name').eq('id', partnerId).maybeSingle();
        if (!alive) return;
        setMatchId(data.id);
        setRandomPartner({ id: partnerId, name: partner?.display_name || 'Internet Friend' });
        setRandomState('matched');
        showNotice('You found someone to chat with!');
      } catch (error) {
        // Keep polling through transient network/RLS failures; the server may still have us queued.
        if (alive && Date.now() - lastPollErrorAt > 5000) {
          lastPollErrorAt = Date.now();
          showNotice(`Could not check matching status; retrying: ${error.message}`);
        }
      } finally {
        checking = false;
      }
    };
    checkForMatch();
    const timer = window.setInterval(checkForMatch, 1800);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session, randomState, showNotice]);

  const cancelRandomChat = async () => {
    // Invalidate any in-flight matchmaking RPC before changing the visible state.
    randomRequestRef.current += 1;
    setRandomState('idle'); setRandomPartner(null); setRandomMessages([]); setMatchId(null);
    if (session && supabase) {
      const leaveOperation = (async () => {
        const { error } = await supabase.rpc('leave_random_match');
        if (error) throw error;
      })();
      randomLeaveRef.current = leaveOperation.catch(error => {
        showNotice(error.message || 'Could not leave the current match.');
      });
      await randomLeaveRef.current;
    }
  };

  const sendRandomMessage = async (event) => {
    event.preventDefault();
    const body = input.trim();
    if (!body || !matchId || !session || !supabase) return;
    if (body.length > 1000) return showNotice('Message is too long (max 1000 characters).');
    const sendingMatchId = matchId;
    const sendingUserId = session.user.id;
    const { data, error } = await supabase.from('random_match_messages')
      .insert({ match_id: sendingMatchId, sender_id: sendingUserId, body })
      .select('id,created_at').single();
    if (error) return showNotice(`Message not sent: ${error.message}`);
    // The user may have left or matched with someone else while the insert was in flight.
    if (sendingMatchId !== matchId || sendingUserId !== session?.user?.id) return;
    setRandomMessages(prev => {
      if (prev.some(message => message.id === data.id)) return prev;
      return [...prev, {
        id: data.id, created_at: data.created_at, mine: true, name: nickname || 'You', body,
        time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }].slice(-200);
    });
    // Preserve text typed after this send began, or text for a different screen.
    if (matchId === sendingMatchId && inputRef.current.trim() === body) setInput('');
  };

  useEffect(() => {
    if (!session || !matchId || !supabase) return;
    let alive = true;
    const mergeMessages = (incoming) => {
      setRandomMessages(prev => {
        const byId = new Map([...prev, ...incoming].map(message => [message.id, message]));
        return [...byId.values()].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).slice(-200);
      });
    };
    (async () => {
      const { data, error } = await supabase.from('random_match_messages')
        .select('id,sender_id,body,created_at').eq('match_id', matchId)
        .order('created_at', { ascending: true }).limit(200);
      if (!alive) return;
      if (error) {
        showNotice(`Could not load random chat history: ${error.message}`);
        return;
      }
      mergeMessages((data || []).map(message => ({
        ...message, mine: message.sender_id === session.user.id,
        name: message.sender_id === session.user.id ? (nickname || 'You') : (randomPartner?.name || 'Stranger'),
        time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
    })();
    const channel = supabase.channel(`random-match:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'random_match_messages', filter: `match_id=eq.${matchId}` }, ({ new: message }) => {
        if (!alive) return;
        mergeMessages([{
          ...message, mine: message.sender_id === session.user.id,
          name: message.sender_id === session.user.id ? (nickname || 'You') : (randomPartner?.name || 'Stranger'),
          time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }).subscribe(state => {
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          if (alive) showNotice('Random chat live updates are unavailable. Check the Supabase Realtime setup.');
        }
      });
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session, matchId, randomPartner, nickname]);

  const sendFriendRequest = async () => {
    const target = friendSearch.trim();
    if (!session || !supabase) return showNotice('Sign in to add permanent friends.');
    if (!target) return showNotice('Enter a display name to search.');
    if (target === session.user.id) return showNotice('You cannot add yourself.');
    setFriendSearchBusy(true);
    try {
      // Treat ordinary names as text. Only use an ID after confirming it is UUID-shaped.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target);
      let query = supabase.from('profiles').select('id,display_name').neq('id', session.user.id).limit(10);
      query = isUuid ? query.eq('id', target) : query.ilike('display_name', `%${target}%`);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) {
        showNotice('No matching profile found. Check the display name and try again.');
        return;
      }
      if (data.length > 1) {
        showNotice('Several profiles match. Enter a more specific display name or the profile UUID.');
        return;
      }
      const person = data[0];
      const { error: requestError } = await supabase.rpc('send_friend_request', {
        p_receiver_id: person.id
      });
      if (requestError) throw requestError;
      setFriendSearch('');
      showNotice(`Friend request sent to ${person.display_name}.`);
    } catch (error) {
      showNotice(`Friend search failed: ${error.message}`);
    } finally {
      setFriendSearchBusy(false);
    }
  };

  const respondFriend = async (request, accept) => {
    const { error } = await supabase.rpc('respond_friend_request', {
      p_request_id: request.id,
      p_accept: accept
    });
    if (error) return showNotice(error.message || 'Could not update friend request.');
    setFriendRequests(prev => prev.filter(r => r.id !== request.id));
    showNotice(accept ? 'Friend added!' : 'Request declined.');
  };

  const reportRoomMessage = (message) => {
    if (!session || !supabase || !message?.senderId || message.mine) {
      showNotice('Sign in to report messages.');
      return;
    }
    setReportReason('');
    setReportTarget({
      userId: message.senderId,
      title: 'Report public message',
      context: `Room: ${message.room || activeRoom}\nMessage: ${String(message.body || '').slice(0, 1500)}`,
      leaveAfterSubmit: false
    });
  };

  const reportRandomPartner = () => {
    if (!session || !supabase || !randomPartner?.id) {
      showNotice('Sign in and connect to a chat before reporting.');
      return;
    }
    const context = randomMessages.slice(-5)
      .map(message => `${message.name || 'User'}: ${message.body || ''}`)
      .join('\n')
      .slice(0, 2000);
    setReportReason('');
    setReportTarget({
      userId: randomPartner.id,
      title: `Report ${randomPartner.name || 'chat partner'}`,
      context,
      leaveAfterSubmit: true
    });
  };

  const submitReport = async (event) => {
    event?.preventDefault();
    if (!session || !supabase || !reportTarget?.userId) return;
    const reason = reportReason.trim().slice(0, 500);
    if (reason.length < 3) {
      showNotice('Please enter at least 3 characters so the report is useful.');
      return;
    }
    setReportBusy(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        reported_user_id: reportTarget.userId,
        reason,
        context: reportTarget.context || ''
      });
      if (error) throw error;
      const shouldLeave = reportTarget.leaveAfterSubmit;
      setReportTarget(null);
      setReportReason('');
      if (shouldLeave) await cancelRandomChat();
      showNotice(shouldLeave
        ? 'Report submitted. You have left the conversation.'
        : 'Message reported. Thank you for helping keep the room safe.');
    } catch (error) {
      showNotice(`Report could not be submitted: ${error.message}`);
    } finally {
      setReportBusy(false);
    }
  };

  const blockRandomPartner = async () => {
    if (!session || !supabase || !randomPartner?.id) {
      showNotice('Sign in and connect to a chat before blocking.');
      return;
    }
    const { error } = await supabase.from('blocks').insert({
      blocker_id: session.user.id,
      blocked_id: randomPartner.id
    });
    if (error && error.code !== '23505') {
      showNotice(`Could not block this person: ${error.message}`);
      return;
    }
    await cancelRandomChat();
    showNotice(error?.code === '23505'
      ? 'This person was already blocked. You have left the conversation.'
      : 'Person blocked. You have left the conversation.');
  };

  const unblockUser = async (person) => {
    if (!session || !supabase || !person?.id) return;
    const { error } = await supabase.from('blocks').delete()
      .eq('blocker_id', session.user.id).eq('blocked_id', person.id);
    if (error) {
      showNotice(`Could not unblock ${person.display_name || 'this person'}: ${error.message}`);
      return;
    }
    setBlockedUsers(prev => prev.filter(user => user.id !== person.id));
    showNotice(`${person.display_name || 'User'} can appear in future random matches again.`);
  };

  const openFriend = async (friend) => {
    if (!session || !supabase) return showNotice('Sign in to message your friends.');
    setDmBusy(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_friend_conversation', { p_friend_id: friend.id });
      if (error) throw error;
      setSelectedFriend(friend);
      setActiveConversationId(data);
      setActiveApp('friends');
      setInput('');
    } catch (error) {
      showNotice(`Could not open private chat: ${error.message}`);
    } finally {
      setDmBusy(false);
    }
  };

  const sendFriendMessage = async (event) => {
    event?.preventDefault();
    const body = input.trim();
    const sendingConversationId = activeConversationId;
    const sendingUserId = session?.user?.id;
    if (!body || !sendingConversationId || !sendingUserId || !supabase) return;
    if (body.length > 1000) return showNotice('Message is too long (max 1000 characters).');
    const { data, error } = await supabase.from('private_messages').insert({
      conversation_id: sendingConversationId, sender_id: sendingUserId, body
    }).select('id,created_at').single();
    if (error) return showNotice(`Message not sent: ${error.message}`);
    setDmMessages(prev => {
      const current = prev[sendingConversationId] || [];
      if (current.some(message => message.id === data.id)) return prev;
      return {
        ...prev,
        [sendingConversationId]: [...current, {
          id: data.id, sender_id: sendingUserId, body,
          created_at: data.created_at, mine: true, name: nickname || 'You',
          time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }].slice(-200)
      };
    });
    // Do not erase a new draft typed while the database insert was in flight.
    if (activeConversationId === sendingConversationId && inputRef.current.trim() === body) setInput('');
  };

  useEffect(() => {
    if (!session || !supabase || !activeConversationId || activeApp !== 'friends') return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('private_messages')
        .select('id,sender_id,body,created_at').eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true }).limit(200);
      if (!alive || error) {
        if (alive && error) showNotice(`Could not load messages: ${error.message}`);
        return;
      }
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: people } = senderIds.length
        ? await supabase.from('profiles').select('id,display_name').in('id', senderIds)
        : { data: [] };
      if (!alive) return;
      const loadedMessages = (data || []).map(m => ({
        ...m, mine: m.sender_id === session.user.id,
        name: people?.find(p => p.id === m.sender_id)?.display_name || (m.sender_id === session.user.id ? nickname : selectedFriend?.display_name) || 'Internet Friend',
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setDmMessages(prev => {
        const existing = prev[activeConversationId] || [];
        const byId = new Map([...loadedMessages, ...existing].map(message => [message.id, message]));
        return { ...prev, [activeConversationId]: [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(-200) };
      });
    })();
    const channel = supabase.channel(`private-chat:${activeConversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${activeConversationId}` }, async ({ new: m }) => {
        if (!alive || m.sender_id === session.user.id) return;
        const { data: person } = await supabase.from('profiles').select('display_name').eq('id', m.sender_id).maybeSingle();
        if (!alive) return;
        setDmMessages(prev => {
          const existing = prev[activeConversationId] || [];
          if (existing.some(item => item.id === m.id)) return prev;
          return { ...prev, [activeConversationId]: [...existing, {
            ...m, mine: false, name: person?.display_name || selectedFriend?.display_name || 'Internet Friend',
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }].slice(-200) };
        });
      }).subscribe((state) => {
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          if (alive) showNotice('Private chat live updates are unavailable. Check the Supabase Realtime setup.');
        }
      });
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session, activeConversationId, activeApp, selectedFriend, nickname, showNotice]);


  const currentRoom = ROOMS.find(r => r.id === activeRoom) || ROOMS[0];
  const windowTitle = activeApp === 'messenger' ? 'Internet Messenger' :
    activeApp === 'random' ? 'Random Stranger Chat' :
    activeApp === 'rooms' ? 'Chatrooms' :
    activeApp === 'friends' ? 'Buddy List' :
    activeApp === 'profile' ? 'My Profile' : 'Internet 2008';

  return (
    <main className="desktop">
      <div className="desktop-wallpaper" />
      <header className="top-strip">
        <div className="brand"><span className="brand-icon"><Monitor size={16}/></span><span>INTERNET <b>2008</b></span></div>
        <div className="top-center"><span className={`connection-dot ${connectionLabel === 'Connected' ? 'live' : ''}`}/>{connectionLabel}</div>
        <div className="top-actions">
          <button className="icon-button" title="Toggle sound" onClick={() => setSoundOn(v => !v)}>{soundOn ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>
          <button className="icon-button" title="Settings" onClick={() => setShowSettings(v => !v)}><Settings size={16}/></button>
          <span className="clock">{nowTime()}</span>
        </div>
      </header>

      <section className="desktop-icons">
        <button className="desktop-icon" onClick={() => { setActiveApp('messenger'); setWindowMinimized(false); }}><span className="app-icon messenger-icon"><MessageCircle/></span><span>Messenger</span></button>
        <button className="desktop-icon" onClick={() => { setActiveApp('rooms'); setWindowMinimized(false); }}><span className="app-icon rooms-icon"><Globe/></span><span>Chatrooms</span></button>
        <button className="desktop-icon" onClick={() => { setActiveApp('random'); setWindowMinimized(false); }}><span className="app-icon random-icon"><Search/></span><span>Find Stranger</span></button>
        <button className="desktop-icon" onClick={() => { setActiveApp('friends'); setWindowMinimized(false); }}><span className="app-icon friends-icon"><Users/></span><span>Buddy List</span></button>
        <button className="desktop-icon" onClick={() => { setActiveApp('profile'); setWindowMinimized(false); }}><span className="app-icon profile-icon"><UserRound/></span><span>My Profile</span></button>
        <button className="desktop-icon" onClick={() => showNotice('Mystery file #001: “Someone is still online… even when the café is closed.” More clues coming soon.')}><span className="app-icon file-icon"><Terminal/></span><span>secret.txt</span></button>
      </section>

      {!windowMinimized && (
        <section className={`app-window ${windowMaximized ? 'maximized' : ''}`} aria-label={windowTitle}>
          <div className="titlebar">
            <div className="titlebar-name"><span className="mini-app-icon"><MessageCircle size={15}/></span>{windowTitle}</div>
            <div className="window-controls">
              <button onClick={() => setWindowMinimized(true)} aria-label="Minimize"><Minus size={15}/></button>
              <button onClick={() => setWindowMaximized(v => !v)} aria-label="Maximize"><Square size={12}/></button>
              <button className="close-control" onClick={() => setWindowMinimized(true)} aria-label="Close"><X size={15}/></button>
            </div>
          </div>
          <div className="menu-bar"><span>File</span><span>Edit</span><span>View</span><span>Tools</span><span>Help</span><span className="menu-right"><Wifi size={12}/> {onlineCount} online</span></div>

          {activeApp === 'messenger' && (
            <div className="messenger-layout">
              <aside className="sidebar">
                <div className="profile-card">
                  <div className="avatar">{(nickname || 'I').slice(0,1).toUpperCase()}</div>
                  <div className="profile-text"><b>{nickname || 'InternetGuest'}</b><span><i className="presence-green"/> {status}</span></div>
                  <button className="tiny-button" onClick={() => setShowSettings(true)}><Settings size={14}/></button>
                </div>
                <div className="sidebar-heading">CHATROOMS <span>{ROOMS.length}</span></div>
                {ROOMS.map(room => {
                  const Icon = room.icon;
                  return <button key={room.id} className={`room-row ${activeRoom === room.id ? 'selected' : ''}`} onClick={() => { setActiveRoom(room.id); setActiveApp('messenger'); setUnread(prev => ({...prev,[room.id]:0})); }}>
                    <span className="room-symbol" style={{background: room.color}}><Icon size={15}/></span>
                    <span className="room-info"><b>{room.name}</b><small>{room.description}</small></span>
                    {unread[room.id] > 0 && <span className="unread">{unread[room.id]}</span>}
                  </button>;
                })}
                <div className="sidebar-heading">YOUR SHORTCUTS</div>
                <button className="nav-row" onClick={() => setActiveApp('random')}><Search size={16}/> Random stranger <ChevronRight size={14}/></button>
                <button className="nav-row" onClick={() => setActiveApp('friends')}><Users size={16}/> Buddy list <ChevronRight size={14}/></button>
                <div className="sidebar-bottom"><span className="tiny-online"/>{onlineCount} friend{onlineCount === 1 ? '' : 's'} online <span className="demo-pill">{isSupabaseConfigured ? 'LIVE' : 'DEMO'}</span></div>
              </aside>
              <section className="chat-panel">
                <div className="chat-heading">
                  <div className="room-symbol large" style={{background: currentRoom.color}}><currentRoom.icon size={20}/></div>
                  <div><h2>{currentRoom.name}</h2><p>{currentRoom.description}</p></div>
                  <button className="icon-button" title="Room details" onClick={() => showNotice('Be kind. No spam, harassment or sharing private information.')}><ShieldAlert size={17}/></button>
                </div>
                <div className="notice-bar"><Radio size={14}/> Welcome back to the old internet. Be kind to each other.</div>
                <div className="daily-signal">
                  <div className="daily-signal-copy"><span><Sparkles size={12}/> DAILY SIGNAL</span><p>{dailyPrompt}</p></div>
                  <button type="button" onClick={() => {setInput(current => current.trim() ? current : `Daily signal: ${dailyPrompt} — `);roomComposerRef.current?.focus();}}>Answer in chat</button>
                </div>
                <div className="messages-area">
                  {roomMessages.length === 0 && <div className="empty-chat"><div className="empty-illustration">☕</div><h3>It’s quiet in here… for now.</h3><p>Say hi and start the conversation.</p><span className="empty-caption">“u there?” — 2008, probably</span></div>}
                  {roomMessages.map(m => <article className={`message ${m.mine ? 'mine' : ''}`} key={m.id}>
                    <div className="message-avatar">{(m.name || '?').slice(0,1).toUpperCase()}</div>
                    <div className="message-content"><div className="message-meta"><b>{m.name}{m.mine ? ' (you)' : ''}</b><time>{m.time}</time>{!m.mine && session && <button type="button" className="message-report" title="Report message" aria-label={`Report message from ${m.name}`} onClick={() => reportRoomMessage(m)}><ShieldAlert size={12}/></button>}</div><div className="message-bubble">{m.body}</div></div>
                  </article>)}
                  <div ref={endRef}/>
                </div>
                <form className="composer" onSubmit={sendRoomMessage}>
                  {showEmoji && <div className="emoji-picker">{EMOJIS.map(e => <button type="button" key={e} onClick={() => setInput(v => v + e)}>{e}</button>)}</div>}
                  <div className="composer-tools"><button type="button" onClick={() => setShowEmoji(v => !v)} title="Emojis"><Smile size={17}/></button><span>Message {currentRoom.name}</span><span className="char-count">{input.length}/1000</span></div>
                  <div className="composer-bottom"><textarea ref={roomComposerRef} value={input} maxLength={1000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRoomMessage(e); } }} placeholder="Type a message… (Enter to send)" rows={2}/><button className="send-button" type="submit" disabled={!input.trim()}><Send size={17}/><span>Send</span></button></div>
                </form>
              </section>
            </div>
          )}

          {activeApp === 'rooms' && <div className="page-panel"><div className="page-title"><Globe/><div><h2>Public chatrooms</h2><p>Find your corner of the old internet.</p></div></div><div className="room-grid">{ROOMS.map(room => { const Icon = room.icon; return <button key={room.id} className="room-card" onClick={() => { setActiveRoom(room.id); setActiveApp('messenger'); }}><span className="room-symbol large" style={{background:room.color}}><Icon/></span><h3>{room.name}</h3><p>{room.description}</p><span className="room-card-bottom"><span className="tiny-online"/> Join room <ChevronRight size={14}/></span></button>; })}</div><p className="page-footnote">Public rooms are visible to signed-in users with access. Keep personal details private.</p></div>}

          {activeApp === 'random' && <div className="page-panel random-page"><div className="page-title"><Search/><div><h2>Random stranger chat</h2><p>Meet someone you haven’t met before.</p></div></div>
            <div className="random-card"><div className="random-orbit"><div className="orbit-dot dot-a"/><div className="orbit-dot dot-b"/><div className="orbit-dot dot-c"/><div className="orbit-center"><MessageCircle size={34}/></div></div>
              {randomState === 'idle' && <><h3>Somewhere, someone is online.</h3><p>Say hello to a random person. You can leave or report at any time.</p><button className="primary-button" onClick={startRandomChat}><Search size={16}/> Find someone</button></>}
              {randomState === 'searching' && <><h3>Looking for someone…</h3><p>Waiting for another available, signed-in person.</p><div className="loading-dots"><i/><i/><i/></div><button className="secondary-button" onClick={cancelRandomChat}>Cancel search</button></>}
              {randomState === 'login' && <><h3>Sign in to meet people</h3><p>Random matching requires an account and live backend so we can apply safety rules.</p><button className="primary-button" onClick={() => {setAuthPanel('welcome');setShowSettings(true);}}>Account settings</button><button className="secondary-button" onClick={() => setRandomState('idle')}>Back</button></>}
              {randomState === 'matched' && <><h3>You’re connected!</h3><p>Talking to {randomPartner?.name || 'an Internet Friend'}</p><div className="random-transcript">{randomMessages.map(m=><div key={m.id} className={m.mine?'mine':''}><b>{m.name}:</b> {m.body}</div>)}</div><form className="random-compose" onSubmit={sendRandomMessage}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Say hello…"/><button className="primary-button"><Send size={15}/></button></form><div className="random-actions"><button className="secondary-button" onClick={cancelRandomChat}><LogOut size={14}/> Leave</button><button className="secondary-button" onClick={reportRandomPartner}><ShieldAlert size={14}/> Report</button><button className="secondary-button" onClick={blockRandomPartner}><X size={14}/> Block</button></div></>}
            </div><div className="safety-note"><LockKeyhole size={16}/><span><b>Your safety matters.</b> Don’t share passwords, address, phone number or payment details. Block/report features should be enabled before public launch.</span></div>
          </div>}

          {activeApp === 'friends' && <div className="page-panel"><div className="page-title"><Users/><div><h2>Buddy list</h2><p>Your internet friends, wherever they are.</p></div></div>
            {selectedFriend && activeConversationId ? <section className="friend-dm-panel"><div className="friend-dm-header"><button className="secondary-button" onClick={() => { setSelectedFriend(null); setActiveConversationId(null); setInput(''); }}><ChevronRight size={15}/> Back to buddies</button><div className="friend-dm-person"><div className="avatar small">{(selectedFriend.display_name||'?')[0]}</div><div><b>{selectedFriend.display_name}</b><small>Private conversation</small></div></div></div><div className="friend-dm-transcript">{(dmMessages[activeConversationId] || []).map(m => <article className={`message ${m.mine ? 'mine' : ''}`} key={m.id}><div className="message-avatar">{(m.name||'?').slice(0,1).toUpperCase()}</div><div className="message-content"><div className="message-meta"><b>{m.name}{m.mine ? ' (you)' : ''}</b><time>{m.time}</time></div><div className="message-bubble">{m.body}</div></div></article>)}{!(dmMessages[activeConversationId] || []).length && <div className="empty-state"><MessageCircle size={28}/><h3>Say hello!</h3><p>This is a private conversation between you and {selectedFriend.display_name}.</p></div>}<div ref={endRef}/></div><form className="composer" onSubmit={sendFriendMessage}><div className="composer-tools"><span>Private message to {selectedFriend.display_name}</span><span className="char-count">{input.length}/1000</span></div><div className="composer-bottom"><textarea value={input} maxLength={1000} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendFriendMessage(e);}}} placeholder="Write a private message… (Enter to send)" rows={2}/><button className="send-button" type="submit" disabled={!input.trim()}><Send size={17}/><span>Send</span></button></div></form></section> : <>
            {!session && <div className="inline-warning"><LockKeyhole size={18}/><div><b>Permanent friends need an account.</b><p>Guest mode only saves this session locally.</p></div><button className="secondary-button" onClick={()=>setShowSettings(true)}>Sign in</button></div>}
            <form className="friend-add" onSubmit={e=>{e.preventDefault();if(friendSearchResults.length===1)sendFriendRequestTo(friendSearchResults[0]);else showNotice(friendSearchResults.length>1 ? "Choose the correct profile from the search results below." : "Wait for profile search results, then choose a friend.");}}><input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Search by display name or profile ID"/><button className="primary-button" disabled={!session || friendSearchBusy || friendSearchLoading || friendSearchResults.length!==1}><UserPlus size={15}/> Add friend</button></form>
            {friendSearchLoading && <small className="muted">Searching profiles…</small>}
            {friendSearchResults.length>0 && <div className="friend-search-results">{friendSearchResults.map(person=><div className="friend-row" key={person.id}><div className="avatar small">{(person.display_name||'?')[0]}</div><div className="friend-info"><b>{person.display_name||'Internet Friend'}</b><small>{person.mood||'Profile match'}</small></div><button type="button" className="primary-button" disabled={friendSearchBusy} onClick={()=>sendFriendRequestTo(person)}><UserPlus size={15}/> Add</button></div>)}</div>}
            {friendSearch.trim().length>=2 && !friendSearchLoading && friendSearchResults.length===0 && <small className="muted">No matching profiles found.</small>}
            {friendRequests.length>0 && <><h3 className="section-label">FRIEND REQUESTS</h3>{friendRequests.map(req=><div className="friend-row" key={req.id}><div className="avatar small">{(req.person?.display_name||'?')[0]}</div><div className="friend-info"><b>{req.person?.display_name||'Internet Friend'}</b><small>Wants to be your friend</small></div><button className="accept-button" onClick={()=>respondFriend(req,true)}><UserCheck size={15}/></button><button className="decline-button" onClick={()=>respondFriend(req,false)}><X size={15}/></button></div>)}</>}
            <h3 className="section-label">YOUR FRIENDS · {friends.length}</h3>
            {friends.map(friend=><div className="friend-row" key={friend.id}><div className="avatar small">{(friend.display_name||'?')[0]}</div><div className="friend-info"><b>{friend.display_name}</b><small>{friend.mood||'Available when online'}</small></div><button className="secondary-button" disabled={dmBusy} onClick={()=>openFriend(friend)}><MessageCircle size={15}/> {dmBusy ? 'Opening…' : 'Message'}</button></div>)}
            {friends.length===0 && friendRequests.length===0 && <div className="empty-state"><Users size={30}/><h3>Your buddy list is waiting.</h3><p>Sign in and add friends by their profile ID.</p></div>}
            </>}
          </div>}

          {activeApp === 'profile' && <div className="page-panel profile-page"><div className="page-title"><UserRound/><div><h2>My profile</h2><p>Your little corner of the internet.</p></div></div><div className="profile-edit-card"><div className="avatar big">{(nickname||'I')[0].toUpperCase()}</div><label>Display name<input maxLength={24} value={nickname} onChange={e=>setNickname(e.target.value)}/></label><label>What are you up to?<input maxLength={80} value={statusText} onChange={e=>setStatusText(e.target.value)}/></label><label>Availability<select value={status} onChange={e=>setStatus(e.target.value)}><option>Available</option><option>Away</option><option>Busy</option><option>Invisible</option></select></label><button className="primary-button" onClick={async()=>{const nextName=nickname.trim().slice(0,24);const nextMood=statusText.trim().slice(0,80);if(!nextName)return showNotice('Choose a display name first.');if(session){const {error}=await supabase.from('profiles').update({display_name:nextName,mood:nextMood}).eq('id',session.user.id);if(error)return showNotice(error.message);}setNickname(nextName);setStatusText(nextMood);setProfile(prev=>prev?{...prev,display_name:nextName,mood:nextMood}:prev);localStorage.setItem('i2008-nickname',nextName);showNotice('Profile updated.');}}><UserCheck size={16}/> Save profile</button></div>
            <section className="blocked-users-card"><div className="blocked-users-heading"><div><h3>Blocked users</h3><p>Blocked people are skipped by random matching.</p></div><span>{blockedUsers.length}</span></div>{blockedLoading ? <small className="muted">Loading blocked users…</small> : blockedUsers.length ? blockedUsers.map(person=><div className="friend-row" key={person.id}><div className="avatar small">{(person.display_name||'?')[0]}</div><div className="friend-info"><b>{person.display_name||'Internet Friend'}</b><small>Blocked by you</small></div><button className="secondary-button" onClick={()=>unblockUser(person)}>Unblock</button></div>) : <p className="blocked-empty">You haven't blocked anyone.</p>}</section></div>}

          <div className="statusbar"><span><span className="tiny-online"/> Ready</span><span>{session ? `Signed in: ${nickname}` : 'Guest session'}</span><span>Internet 2008 v1.0</span></div>
        </section>
      )}

      {windowMinimized && <button className="restore-window" onClick={() => setWindowMinimized(false)}><MessageCircle size={16}/> {windowTitle}</button>}

      <footer className="taskbar"><button className="start-button" onClick={()=>{setActiveApp('messenger');setWindowMinimized(false);}}><span className="start-orb"><Monitor size={16}/></span><b>Start</b></button><div className="taskbar-divider"/><button className={`taskbar-app ${activeApp==='messenger'?'active':''}`} onClick={()=>{setActiveApp('messenger');setWindowMinimized(false);}}><MessageCircle size={15}/> Messenger</button><button className={`taskbar-app ${activeApp==='random'?'active':''}`} onClick={()=>{setActiveApp('random');setWindowMinimized(false);}}><Search size={15}/> Random Chat</button><div className="taskbar-spacer"/><div className="system-tray"><span className="tray-status"><span className="tiny-online"/>{session?'Online':'Guest'}</span><span>{nowTime()}</span></div></footer>

      {reportTarget && <div className="modal-backdrop" onClick={() => {if (!reportBusy) setReportTarget(null);}}>
        <section className="settings-modal report-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-title"><div><ShieldAlert size={18}/> {reportTarget.title}</div><button className="icon-button" disabled={reportBusy} onClick={() => setReportTarget(null)} aria-label="Close report form"><X size={17}/></button></div>
          <form className="auth-form" onSubmit={submitReport}>
            <p>Tell us what happened. Recent chat context is attached to help review the report.</p>
            <label>Reason<textarea required minLength={3} maxLength={500} value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Spam, harassment, unsafe content…" rows={4}/></label>
            <div className="report-modal-actions"><button className="secondary-button" type="button" disabled={reportBusy} onClick={() => setReportTarget(null)}>Cancel</button><button className="primary-button" type="submit" disabled={reportBusy || reportReason.trim().length < 3}><ShieldAlert size={15}/>{reportBusy ? 'Submitting…' : 'Submit report'}</button></div>
          </form>
        </section>
      </div>}

      {showSettings && <div className="modal-backdrop" onClick={()=>setShowSettings(false)}><section className="settings-modal" onClick={e=>e.stopPropagation()}><div className="modal-title"><div><Settings size={18}/> Account & settings</div><button className="icon-button" onClick={()=>setShowSettings(false)}><X size={17}/></button></div>
        {session ? <div className="signed-in-card"><div className="avatar">{(nickname||'I')[0]}</div><div><b>{nickname}</b><p>Anonymous chat account</p><small>Session connected</small></div><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sign out</button></div> : <form className="auth-form" onSubmit={signIn}><h3>Welcome to Internet 2008</h3><p>Enter your name to start chatting. No email or password needed.</p><label>Your name<input maxLength={24} required value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="e.g. dialup_dreamer"/></label><button className="primary-button full" disabled={authBusy}>{authBusy?'Connecting…':'Start chatting'}</button>{authError&&<p className="auth-error">{authError}</p>}</form>}
        <div className="settings-foot"><span className={`connection-dot ${connectionLabel==='Connected'?'live':''}`}/><span>{connectionLabel}</span><span className="settings-foot-spacer"/>{isSupabaseConfigured?'Backend configured':'Backend not configured'}</div>
        <p className="privacy-small">Never share your password. Use block/report tools and keep personal information private. This is an open-source starter; review security and moderation before public launch.</p>
      </section></div>}

      {notice && <div className="toast"><Bell size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
      <div className="desktop-watermark">YOU’VE GOT MAIL <span>✦</span></div>
    </main>
  );
}

export default App;
