import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor, MessageCircle, Users, UserRound, Search, Settings, Minus, Square,
  X, Smile, Send, Volume2, VolumeX, Radio, ShieldAlert, UserPlus, LogOut,
  RefreshCw, Wifi, WifiOff, ChevronRight, Globe, Gamepad2, Moon, Heart,
  Bell, UserCheck, UserMinus, Copy, LockKeyhole, Sparkles, Terminal, Coffee, ArrowLeft, ArrowRight, Home, Star, ExternalLink
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
  const [messengerView, setMessengerView] = useState('home');
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
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineIds, setOnlineIds] = useState([]);
  const [soundOn, setSoundOn] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [status, setStatus] = useState('Available');
  const [notice, setNotice] = useState('');
  const [notifications, setNotifications] = useState(() => { try { return JSON.parse(localStorage.getItem('i2008-notifications') || '[]'); } catch { return []; } });
  const [showActivityCenter, setShowActivityCenter] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [desktopContext, setDesktopContext] = useState(null);
  const [iconsArranged, setIconsArranged] = useState(false);
  const [showGadgetPicker, setShowGadgetPicker] = useState(false);
  const [visibleGadgets, setVisibleGadgets] = useState(() => { try { return JSON.parse(localStorage.getItem('i2008-gadgets-visible') || '[\"clock\",\"calendar\",\"notes\",\"feed\"]'); } catch { return ['clock','calendar','notes','feed']; } });
  const [gadgetPositions, setGadgetPositions] = useState(() => { try { return JSON.parse(localStorage.getItem('i2008-gadgets-positions') || '{}'); } catch { return {}; } });
  const [stickyNote, setStickyNote] = useState(() => localStorage.getItem('i2008-sticky-note') || 'Remember the good old days…');
  const [recentApps, setRecentApps] = useState(() => { try { return JSON.parse(localStorage.getItem('i2008-recent-apps') || '["messenger","browser"]'); } catch { return ['messenger','browser']; } });
  const [browserUrl, setBrowserUrl] = useState('http://www.internet2008.local/');
  const [browserAddress, setBrowserAddress] = useState('http://www.internet2008.local/');
  const [browserHistory, setBrowserHistory] = useState(['http://www.internet2008.local/']);
  const [browserIndex, setBrowserIndex] = useState(0);
  const [browserBookmarks, setBrowserBookmarks] = useState(() => { try { return JSON.parse(localStorage.getItem('i2008-browser-bookmarks') || '[]'); } catch { return []; } });
  const [browserSearch, setBrowserSearch] = useState('');
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
  const [statusText, setStatusText] = useState('Listening to old internet');
  const [connectionLabel, setConnectionLabel] = useState(isSupabaseConfigured ? 'Connecting…' : 'Local demo mode');
  const endRef = useRef(null);
  const realtimeRef = useRef([]);
  const identity = session?.user?.id || profile?.id || 'guest';

  const showNotice = useCallback((msg) => {
    setNotifications(prev => [{ id: localId(), message: msg, time: new Date().toISOString(), read: false }, ...prev].slice(0, 40));
    setNotice(msg);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(''), 3500);
  }, []);

  useEffect(() => { localStorage.setItem('i2008-notifications', JSON.stringify(notifications)); }, [notifications]);

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
      const { error } = await supabase.from('friend_requests').insert({ sender_id: session.user.id, receiver_id: person.id });
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
    if (supabase && session) await supabase.auth.signOut();
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
    setRandomState('searching'); setRandomPartner(null); setMatchId(null);
    const { data, error } = await supabase.rpc('find_random_match');
    if (error) {
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

  const cancelRandomChat = async () => {
    if (session && supabase) {
      const { error } = await supabase.rpc('leave_random_match');
      if (error) showNotice(error.message);
    }
    setRandomState('idle'); setRandomPartner(null); setRandomMessages([]); setMatchId(null);
  };

  const sendRandomMessage = async (event) => {
    event.preventDefault();
    const body = input.trim();
    if (!body || !matchId) return;
    const { error } = await supabase.from('random_match_messages').insert({ match_id: matchId, sender_id: session.user.id, body });
    if (error) return showNotice(error.message);
    setRandomMessages(prev => [...prev, { id: localId(), mine: true, name: nickname, body, time: nowTime() }]);
    setInput('');
  };

  useEffect(() => {
    if (!session || !matchId || !supabase) return;
    const channel = supabase.channel(`random-match:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'random_match_messages', filter: `match_id=eq.${matchId}` }, async ({ new: m }) => {
        if (m.sender_id === session.user.id) return;
        setRandomMessages(prev => [...prev, { id: m.id, mine: false, name: randomPartner?.name || 'Stranger', body: m.body, time: nowTime() }]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, matchId, randomPartner]);

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
      const { error: requestError } = await supabase.from('friend_requests').insert({
        sender_id: session.user.id,
        receiver_id: person.id
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

  const removeFriend = async (friend) => {
    if (!session || !supabase || !friend?.id) return;
    const friendName = friend.display_name || 'this friend';
    if (!window.confirm(`Remove ${friendName} from your friends? Your private chat access will be revoked for both accounts. Existing messages will be retained but inaccessible.`)) return;
    setDmBusy(true);
    try {
      const { error } = await supabase.rpc('remove_friend_and_revoke_chat', { p_friend_id: friend.id });
      if (error) throw error;
      setFriends(prev => prev.filter(item => item.id !== friend.id));
      if (selectedFriend?.id === friend.id) {
        setSelectedFriend(null);
        setActiveConversationId(null);
        setInput('');
      }
      showNotice(`${friendName} removed. Private chat access revoked.`);
    } catch (error) {
      showNotice(`Could not remove friend: ${error.message}`);
    } finally {
      setDmBusy(false);
    }
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


  const openDesktopContext = (event) => {
    if (event.target.closest('.app-window, .taskbar, .top-strip, .activity-center, .gadget-picker, .desktop-gadget, .desktop-gadget-toolbar, .start-menu')) return;
    event.preventDefault(); setShowStartMenu(false);
    setDesktopContext({ x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 245) });
  };
  const runDesktopCommand = (command) => {
    setDesktopContext(null);
    if (command === 'refresh') { setShowGadgetPicker(false); showNotice('Desktop refreshed.'); }
    else if (command === 'arrange') { setIconsArranged(value => !value); showNotice(iconsArranged ? 'Desktop icon layout restored.' : 'Desktop icons arranged.'); }
    else if (command === 'folder') showNotice('New Folder created. Folder management is coming next.');
    else if (command === 'personalize' || command === 'display') setShowSettings(true);
    else if (command === 'gadgets') setShowGadgetPicker(true);
  };

  const launchApp = (appId) => {
    if (['rooms','random','friends','profile'].includes(appId)) { setActiveApp('messenger'); setMessengerView(appId); }
    else { setActiveApp(appId); if (appId === 'messenger') setMessengerView('home'); }
    setWindowMinimized(false); setShowStartMenu(false);
    const recentId = ['rooms','random','friends','profile'].includes(appId) ? 'messenger' : appId;
    setRecentApps(prev => [recentId, ...prev.filter(id => id !== recentId)].slice(0, 4));
  };
  useEffect(() => { localStorage.setItem('i2008-recent-apps', JSON.stringify(recentApps)); }, [recentApps]);
  useEffect(() => { localStorage.setItem('i2008-gadgets-visible', JSON.stringify(visibleGadgets)); }, [visibleGadgets]);
  useEffect(() => { localStorage.setItem('i2008-gadgets-positions', JSON.stringify(gadgetPositions)); }, [gadgetPositions]);
  useEffect(() => { localStorage.setItem('i2008-sticky-note', stickyNote); }, [stickyNote]);
  const moveGadget = (id, event) => { const bounds = event.currentTarget.parentElement.getBoundingClientRect(); setGadgetPositions(prev => ({ ...prev, [id]: { x: Math.max(8, Math.min(event.clientX - bounds.left - 75, bounds.width - 170)), y: Math.max(72, Math.min(event.clientY - bounds.top - 18, bounds.height - 190)) } })); };
  const gadgetStyle = (id, fallbackTop) => ({ left: gadgetPositions[id]?.x ?? undefined, top: gadgetPositions[id]?.y ?? fallbackTop, right: gadgetPositions[id]?.x == null ? 22 : undefined });

  const navigateBrowser = (target) => {
    const next = target.trim();
    if (!next) return;
    setBrowserUrl(next); setBrowserAddress(next);
    setBrowserHistory(prev => [...prev.slice(0, browserIndex + 1), next]);
    setBrowserIndex(prev => prev + 1);
  };
  const moveBrowser = (delta) => {
    const nextIndex = browserIndex + delta;
    if (nextIndex < 0 || nextIndex >= browserHistory.length) return;
    setBrowserIndex(nextIndex); setBrowserUrl(browserHistory[nextIndex]); setBrowserAddress(browserHistory[nextIndex]);
  };
  useEffect(() => { localStorage.setItem('i2008-browser-bookmarks', JSON.stringify(browserBookmarks)); }, [browserBookmarks]);

  const currentRoom = ROOMS.find(r => r.id === activeRoom) || ROOMS[0];
  const windowTitle = activeApp === 'browser' ? 'Internet Explorer' : 'Windows Live Messenger';

  return (
    <main className="desktop" onContextMenu={openDesktopContext} onClick={(event) => { if (desktopContext && !event.target.closest(".desktop-context-menu")) setDesktopContext(null); }}>
      <div className="desktop-wallpaper" />
      <header className="top-strip">
        <div className="brand"><span className="brand-icon"><Monitor size={16}/></span><span>INTERNET <b>2008</b></span></div>
        <div className="top-center"><span className={`connection-dot ${connectionLabel === 'Connected' ? 'live' : ''}`}/>{connectionLabel}</div>
        <div className="top-actions">
          <button className={`icon-button activity-trigger ${showActivityCenter ? 'selected' : ''}`} title="Activity Center" aria-label="Activity Center" onClick={() => setShowActivityCenter(v => !v)}><Bell size={16}/>{notifications.some(n => !n.read) && <i>{notifications.filter(n => !n.read).length}</i>}</button>
          <button className="icon-button" title="Toggle sound" onClick={() => setSoundOn(v => !v)}>{soundOn ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>
          <button className="icon-button" title="Settings" onClick={() => setShowSettings(v => !v)}><Settings size={16}/></button>
          <span className="clock">{nowTime()}</span>
        </div>
      </header>

      {showActivityCenter && <section className="activity-center"><div className="activity-head"><div><b>Activity Center</b><small>Your Internet 2008 system log</small></div><button className="icon-button" onClick={() => setShowActivityCenter(false)} aria-label="Close activity center"><X size={15}/></button></div><div className="activity-tools"><span>{notifications.filter(n => !n.read).length} unread</span><button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}>Mark all read</button><button onClick={() => setNotifications([])}>Clear all</button></div><div className="activity-list">{notifications.length ? notifications.map(item => <article key={item.id} className={`activity-item ${item.read ? '' : 'unread-item'}`}><span className="activity-icon"><Bell size={14}/></span><div><p>{item.message}</p><time>{new Date(item.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><button aria-label="Mark notification read" onClick={() => setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))}>✓</button></article>) : <div className="activity-empty"><Bell size={25}/><b>All quiet on the internet.</b><span>System activity will show up here.</span></div>}</div></section>}

      <div className="desktop-gadget-toolbar"><button onClick={()=>setShowGadgetPicker(v=>!v)}><Sparkles size={14}/> Desktop Gadgets</button></div>
      {showGadgetPicker && <section className="gadget-picker"><div><b>Desktop Gadgets</b><button onClick={()=>setShowGadgetPicker(false)} aria-label="Close gadgets"><X size={14}/></button></div>{[['clock','Analog Clock'],['calendar','Calendar'],['notes','Sticky Notes'],['feed','Internet Feed']].map(([id,label])=><button key={id} onClick={()=>setVisibleGadgets(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}><span>{visibleGadgets.includes(id)?'✓':'＋'}</span>{label}</button>)}</section>}
      <section className="desktop-gadgets" aria-label="Desktop gadgets">
        {visibleGadgets.includes('clock') && <article className="desktop-gadget clock-gadget" style={gadgetStyle('clock',92)} draggable onDragEnd={e=>moveGadget('clock',e)}><div className="gadget-grip"><span>GADGET</span><button title="Hide clock" onClick={()=>setVisibleGadgets(p=>p.filter(x=>x!=='clock'))}>×</button></div><div className="analog-clock"><div className="clock-hand hour-hand"/><div className="clock-hand minute-hand"/><i/></div><b>{nowTime()}</b><small>LOCAL TIME</small></article>}
        {visibleGadgets.includes('calendar') && <article className="desktop-gadget calendar-gadget" style={gadgetStyle('calendar',285)} draggable onDragEnd={e=>moveGadget('calendar',e)}><div className="gadget-grip"><span>CALENDAR</span><button title="Hide calendar" onClick={()=>setVisibleGadgets(p=>p.filter(x=>x!=='calendar'))}>×</button></div><div className="calendar-month">{new Date().toLocaleDateString([], {month:'long',year:'numeric'})}</div><div className="calendar-date">{new Date().getDate()}</div><small>{new Date().toLocaleDateString([], {weekday:'long'})}</small></article>}
        {visibleGadgets.includes('notes') && <article className="desktop-gadget notes-gadget" style={gadgetStyle('notes',478)} draggable onDragEnd={e=>moveGadget('notes',e)}><div className="gadget-grip"><span>STICKY NOTES</span><button title="Hide notes" onClick={()=>setVisibleGadgets(p=>p.filter(x=>x!=='notes'))}>×</button></div><textarea draggable={false} value={stickyNote} onChange={e=>setStickyNote(e.target.value)} placeholder="Write a little reminder…"/></article>}
        {visibleGadgets.includes('feed') && <article className="desktop-gadget feed-gadget" style={gadgetStyle('feed',650)} draggable onDragEnd={e=>moveGadget('feed',e)}><div className="gadget-grip"><span>INTERNET FEED</span><button title="Hide feed" onClick={()=>setVisibleGadgets(p=>p.filter(x=>x!=='feed'))}>×</button></div><div className="feed-line">✦ Welcome back to 2008</div><div className="feed-line">♫ Your friends are just a click away</div><div className="feed-line">⌁ The internet never sleeps…</div></article>}
      </section>
      {desktopContext && <section className="desktop-context-menu" style={{ left: desktopContext.x, top: desktopContext.y }} onClick={e => e.stopPropagation()} role="menu" aria-label="Desktop options">
        <button role="menuitem" onClick={() => runDesktopCommand('refresh')}><RefreshCw size={14}/> Refresh</button>
        <div className="desktop-context-separator"/>
        <button role="menuitem" onClick={() => runDesktopCommand('arrange')}><Monitor size={14}/> {iconsArranged ? 'Restore Icon Layout' : 'Arrange Icons'}</button>
        <button role="menuitem" onClick={() => runDesktopCommand('folder')}><span>📁</span> New Folder</button>
        <div className="desktop-context-separator"/>
        <button role="menuitem" onClick={() => runDesktopCommand('personalize')}><Sparkles size={14}/> Personalize</button>
        <button role="menuitem" onClick={() => runDesktopCommand('gadgets')}><Sparkles size={14}/> Gadgets</button>
        <button role="menuitem" onClick={() => runDesktopCommand('display')}><Monitor size={14}/> Display Properties</button>
      </section>}
      <section className={`desktop-icons ${iconsArranged ? 'icons-arranged' : ''}`}>
        <button className="desktop-icon" onClick={() => { setActiveApp('messenger'); setWindowMinimized(false); }}><span className="app-icon messenger-icon"><MessageCircle/></span><span>Messenger</span></button>
        <button className="desktop-icon" onClick={() => { setActiveApp('browser'); setWindowMinimized(false); }}><span className="app-icon browser-icon"><Globe/></span><span>Internet Explorer</span></button>
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

          {activeApp === 'browser' && <div className="browser-shell">
            <div className="browser-toolbar"><button title="Back" disabled={browserIndex===0} onClick={()=>moveBrowser(-1)}><ArrowLeft size={16}/></button><button title="Forward" disabled={browserIndex>=browserHistory.length-1} onClick={()=>moveBrowser(1)}><ArrowRight size={16}/></button><button title="Home" onClick={()=>navigateBrowser('http://www.internet2008.local/')}><Home size={15}/></button><form onSubmit={e=>{e.preventDefault();navigateBrowser(browserAddress.startsWith('http')?browserAddress:`http://${browserAddress}`);}}><span><LockKeyhole size={12}/></span><input aria-label="Address" value={browserAddress} onChange={e=>setBrowserAddress(e.target.value)}/><button type="submit">Go</button></form><button title="Add to Favorites" onClick={()=>setBrowserBookmarks(prev=>prev.some(b=>b.url===browserUrl)?prev:[...prev,{url:browserUrl,title:browserUrl.replace('http://','')}])}><Star size={15}/></button></div>
            <div className="browser-favorites"><b>Favorites</b>{browserBookmarks.map(b=><button key={b.url} onClick={()=>navigateBrowser(b.url)}>{b.title}</button>)}</div>
            <div className="browser-page">
              {browserUrl==='http://www.internet2008.local/' || browserUrl==='http://www.internet2008.local' ? <div className="ie-home"><div className="ie-logo"><Globe size={34}/><div><b>the internet</b><small>it's a big place. explore it.</small></div></div><form className="ie-search" onSubmit={e=>{e.preventDefault();navigateBrowser(`http://search.internet2008.local/?q=${encodeURIComponent(browserSearch.trim())}`);}}><input value={browserSearch} onChange={e=>setBrowserSearch(e.target.value)} placeholder="Search the web…"/><button>Search</button></form><div className="ie-columns"><section><h3>What's happening online</h3><button onClick={()=>navigateBrowser('http://social.internet2008.local/')}>✉ MySpace-ish Social Network <small>Connect with your friends</small></button><button onClick={()=>navigateBrowser('http://music.internet2008.local/')}>♫ MP3 Music Corner <small>Discover the sounds of 2008</small></button><button onClick={()=>navigateBrowser('http://games.internet2008.local/')}>▣ Flash Game Arcade <small>One more game before dinner</small></button></section><section><h3>Internet 2008 links</h3><p>Welcome to your little corner of the web. No feeds, no algorithms — just websites.</p><div className="ie-stamp">BEST VIEWED AT 1024 × 768</div></section></div></div> : browserUrl.startsWith('http://search.internet2008.local/') ? <div className="ie-content"><h2>Search results</h2><p>Showing results for <b>{decodeURIComponent(browserUrl.split('q=')[1]||'').replace(/\+/g,' ')}</b></p>{[['Social Network','http://social.internet2008.local/'],['Music Corner','http://music.internet2008.local/'],['Flash Game Arcade','http://games.internet2008.local/']].map(([name,url])=><article><a onClick={()=>navigateBrowser(url)}>{name}</a><p>A little piece of the 2008 internet.</p></article>)}</div> : <div className="ie-content"><div className="ie-site-head"><span>INTERNET 2008 NETWORK</span><small>{browserUrl}</small></div>{browserUrl.includes('social.internet2008.local') ? <><h2>Friends Space</h2><p>Your people. Your profile. Your corner of the web.</p><button onClick={()=>{setActiveApp('friends');}}>Open Buddy List</button><button onClick={()=>{setActiveApp('messenger'); setMessengerView('profile');}}>Edit your profile</button></> : browserUrl.includes('music.internet2008.local') ? <><h2>MP3 Music Corner</h2><p>Now playing in your imagination: the summer of 2008.</p><div className="ie-feature">♫ Featured playlist<br/><b>Dial-up Dreams · 2008 Mix</b><small>Music discovery demo — audio streaming isn't connected yet.</small></div></> : browserUrl.includes('games.internet2008.local') ? <><h2>Flash Game Arcade</h2><p>Take a break and play something.</p><div className="ie-feature">▣ The Loading Game<br/><b>Coming soon to the arcade</b><small>Classic browser games will live here.</small></div></> : <><h2>Hmm… Internet Explorer cannot display this page.</h2><p>This address isn't part of the Internet 2008 world yet.</p><button onClick={()=>navigateBrowser('http://www.internet2008.local/')}>Go to homepage</button></>}</div>}
            </div><div className="browser-status"><span><span className="tiny-online"/> Done</span><span>Internet Explorer 7 · Internet 2008</span></div>
          </div>}

          {activeApp === 'messenger' && messengerView === 'home' && (
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
                <button className="nav-row" onClick={() => setMessengerView('random')}><Search size={16}/> Find a stranger <ChevronRight size={14}/></button>
                <button className="nav-row" onClick={() => setMessengerView('friends')}><Users size={16}/> Buddy list <ChevronRight size={14}/></button>
                <button className="nav-row" onClick={() => setMessengerView('profile')}><UserRound size={16}/> My profile <ChevronRight size={14}/></button>
                <button className="nav-row" onClick={() => setMessengerView('rooms')}><Globe size={16}/> Chatrooms <ChevronRight size={14}/></button>
                <div className="sidebar-bottom"><span className="tiny-online"/>{onlineCount} friend{onlineCount === 1 ? '' : 's'} online <span className="demo-pill">{isSupabaseConfigured ? 'LIVE' : 'DEMO'}</span></div>
              </aside>
              <section className="chat-panel">
                <div className="chat-heading">
                  <div className="room-symbol large" style={{background: currentRoom.color}}><currentRoom.icon size={20}/></div>
                  <div><h2>{currentRoom.name}</h2><p>{currentRoom.description}</p></div>
                  <button className="icon-button" title="Room details" onClick={() => showNotice('Be kind. No spam, harassment or sharing private information.')}><ShieldAlert size={17}/></button>
                </div>
                <div className="notice-bar"><Radio size={14}/> Welcome back to the old internet. Be kind to each other.</div>
                <div className="messages-area">
                  {roomMessages.length === 0 && <div className="empty-chat"><div className="empty-illustration">☕</div><h3>It’s quiet in here… for now.</h3><p>Say hi and start the conversation.</p><span className="empty-caption">“u there?” — 2008, probably</span></div>}
                  {roomMessages.map(m => <article className={`message ${m.mine ? 'mine' : ''}`} key={m.id}>
                    <div className="message-avatar">{(m.name || '?').slice(0,1).toUpperCase()}</div>
                    <div className="message-content"><div className="message-meta"><b>{m.name}{m.mine ? ' (you)' : ''}</b><time>{m.time}</time></div><div className="message-bubble">{m.body}</div></div>
                  </article>)}
                  <div ref={endRef}/>
                </div>
                <form className="composer" onSubmit={sendRoomMessage}>
                  {showEmoji && <div className="emoji-picker">{EMOJIS.map(e => <button type="button" key={e} onClick={() => setInput(v => v + e)}>{e}</button>)}</div>}
                  <div className="composer-tools"><button type="button" onClick={() => setShowEmoji(v => !v)} title="Emojis"><Smile size={17}/></button><span>Message {currentRoom.name}</span><span className="char-count">{input.length}/1000</span></div>
                  <div className="composer-bottom"><textarea value={input} maxLength={1000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRoomMessage(e); } }} placeholder="Type a message… (Enter to send)" rows={2}/><button className="send-button" type="submit" disabled={!input.trim()}><Send size={17}/><span>Send</span></button></div>
                </form>
              </section>
            </div>
          )}

          {activeApp === 'messenger' && messengerView === 'rooms' && <div className="page-panel"><div className="page-title"><Globe/><div><h2>Public chatrooms</h2><p>Find your corner of the old internet.</p></div></div><div className="room-grid">{ROOMS.map(room => { const Icon = room.icon; return <button key={room.id} className="room-card" onClick={() => { setActiveRoom(room.id); setActiveApp('messenger'); setMessengerView('home'); }}><span className="room-symbol large" style={{background:room.color}}><Icon/></span><h3>{room.name}</h3><p>{room.description}</p><span className="room-card-bottom"><span className="tiny-online"/> Join room <ChevronRight size={14}/></span></button>; })}</div><p className="page-footnote">Public rooms are visible to signed-in users with access. Keep personal details private.</p></div>}

          {activeApp === 'messenger' && messengerView === 'random' && <div className="page-panel random-page"><div className="page-title"><Search/><div><h2>Random stranger chat</h2><p>Meet someone you haven’t met before.</p></div></div>
            <div className="random-card"><div className="random-orbit"><div className="orbit-dot dot-a"/><div className="orbit-dot dot-b"/><div className="orbit-dot dot-c"/><div className="orbit-center"><MessageCircle size={34}/></div></div>
              {randomState === 'idle' && <><h3>Somewhere, someone is online.</h3><p>Say hello to a random person. You can leave or report at any time.</p><button className="primary-button" onClick={startRandomChat}><Search size={16}/> Find someone</button></>}
              {randomState === 'searching' && <><h3>Looking for someone…</h3><p>Waiting for another available, signed-in person.</p><div className="loading-dots"><i/><i/><i/></div><button className="secondary-button" onClick={cancelRandomChat}>Cancel search</button></>}
              {randomState === 'login' && <><h3>Sign in to meet people</h3><p>Random matching requires an account and live backend so we can apply safety rules.</p><button className="primary-button" onClick={() => {setAuthPanel('welcome');setShowSettings(true);}}>Account settings</button><button className="secondary-button" onClick={() => setRandomState('idle')}>Back</button></>}
              {randomState === 'matched' && <><h3>You’re connected!</h3><p>Talking to {randomPartner?.name || 'an Internet Friend'}</p><div className="random-transcript">{randomMessages.map(m=><div key={m.id} className={m.mine?'mine':''}><b>{m.name}:</b> {m.body}</div>)}</div><form className="random-compose" onSubmit={sendRandomMessage}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Say hello…"/><button className="primary-button"><Send size={15}/></button></form><div className="random-actions"><button className="secondary-button" onClick={cancelRandomChat}><LogOut size={14}/> Leave</button><button className="secondary-button" onClick={() => showNotice('Report flow: connect your moderation review process before public launch.')}><ShieldAlert size={14}/> Report</button></div></>}
            </div><div className="safety-note"><LockKeyhole size={16}/><span><b>Your safety matters.</b> Don’t share passwords, address, phone number or payment details. Block/report features should be enabled before public launch.</span></div>
          </div>}

          {activeApp === 'messenger' && messengerView === 'friends' && <div className="page-panel"><div className="page-title"><Users/><div><h2>Buddy list</h2><p>Your internet friends, wherever they are.</p></div></div>
            {selectedFriend && activeConversationId ? <section className="friend-dm-panel"><div className="friend-dm-header"><button className="secondary-button" onClick={() => { setSelectedFriend(null); setActiveConversationId(null); setInput(''); }}><ChevronRight size={15}/> Back to buddies</button><div className="friend-dm-person"><div className="avatar small">{(selectedFriend.display_name||'?')[0]}</div><div><b>{selectedFriend.display_name}</b><small>Private conversation</small></div></div></div><div className="friend-dm-transcript">{(dmMessages[activeConversationId] || []).map(m => <article className={`message ${m.mine ? 'mine' : ''}`} key={m.id}><div className="message-avatar">{(m.name||'?').slice(0,1).toUpperCase()}</div><div className="message-content"><div className="message-meta"><b>{m.name}{m.mine ? ' (you)' : ''}</b><time>{m.time}</time></div><div className="message-bubble">{m.body}</div></div></article>)}{!(dmMessages[activeConversationId] || []).length && <div className="empty-state"><MessageCircle size={28}/><h3>Say hello!</h3><p>This is a private conversation between you and {selectedFriend.display_name}.</p></div>}<div ref={endRef}/></div><form className="composer" onSubmit={sendFriendMessage}><div className="composer-tools"><span>Private message to {selectedFriend.display_name}</span><span className="char-count">{input.length}/1000</span></div><div className="composer-bottom"><textarea value={input} maxLength={1000} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendFriendMessage(e);}}} placeholder="Write a private message… (Enter to send)" rows={2}/><button className="send-button" type="submit" disabled={!input.trim()}><Send size={17}/><span>Send</span></button></div></form></section> : <>
            {!session && <div className="inline-warning"><LockKeyhole size={18}/><div><b>Permanent friends need an account.</b><p>Guest mode only saves this session locally.</p></div><button className="secondary-button" onClick={()=>setShowSettings(true)}>Sign in</button></div>}
            <form className="friend-add" onSubmit={e=>{e.preventDefault();if(friendSearchResults.length===1)sendFriendRequestTo(friendSearchResults[0]);else showNotice(friendSearchResults.length>1 ? "Choose the correct profile from the search results below." : "Wait for profile search results, then choose a friend.");}}><input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Search by display name or profile ID"/><button className="primary-button" disabled={!session || friendSearchBusy || friendSearchLoading || friendSearchResults.length!==1}><UserPlus size={15}/> Add friend</button></form>
            {friendSearchLoading && <small className="muted">Searching profiles…</small>}
            {friendSearchResults.length>0 && <div className="friend-search-results">{friendSearchResults.map(person=><div className="friend-row" key={person.id}><div className="avatar small">{(person.display_name||'?')[0]}</div><div className="friend-info"><b>{person.display_name||'Internet Friend'}</b><small>{person.mood||'Profile match'}</small></div><button type="button" className="primary-button" disabled={friendSearchBusy} onClick={()=>sendFriendRequestTo(person)}><UserPlus size={15}/> Add</button></div>)}</div>}
            {friendSearch.trim().length>=2 && !friendSearchLoading && friendSearchResults.length===0 && <small className="muted">No matching profiles found.</small>}
            {friendRequests.length>0 && <><h3 className="section-label">FRIEND REQUESTS</h3>{friendRequests.map(req=><div className="friend-row" key={req.id}><div className="avatar small">{(req.person?.display_name||'?')[0]}</div><div className="friend-info"><b>{req.person?.display_name||'Internet Friend'}</b><small>Wants to be your friend</small></div><button className="accept-button" onClick={()=>respondFriend(req,true)}><UserCheck size={15}/></button><button className="decline-button" onClick={()=>respondFriend(req,false)}><X size={15}/></button></div>)}</>}
            <h3 className="section-label">YOUR FRIENDS · {friends.length}</h3>
            {friends.map(friend=><div className="friend-row" key={friend.id}><div className="avatar small">{(friend.display_name||'?')[0]}</div><div className="friend-info"><b>{friend.display_name}</b><small>{friend.mood||'Available when online'}</small></div><button className="secondary-button" disabled={dmBusy} onClick={()=>openFriend(friend)}><MessageCircle size={15}/> {dmBusy ? 'Opening…' : 'Message'}</button><button type="button" className="decline-button" title={`Remove ${friend.display_name} from friends`} aria-label={`Remove ${friend.display_name} from friends`} disabled={dmBusy} onClick={()=>removeFriend(friend)}><UserMinus size={15}/></button></div>)}
            {friends.length===0 && friendRequests.length===0 && <div className="empty-state"><Users size={30}/><h3>Your buddy list is waiting.</h3><p>Sign in and add friends by their profile ID.</p></div>}
            </>}
          </div>}

          {activeApp === 'messenger' && messengerView === 'profile' && <div className="page-panel profile-page"><div className="page-title"><UserRound/><div><h2>My profile</h2><p>Your little corner of the internet.</p></div></div><div className="profile-edit-card"><div className="avatar big">{(nickname||'I')[0].toUpperCase()}</div><label>Display name<input maxLength={24} value={nickname} onChange={e=>setNickname(e.target.value)}/></label><label>What are you up to?<input maxLength={80} value={statusText} onChange={e=>setStatusText(e.target.value)}/></label><label>Availability<select value={status} onChange={e=>setStatus(e.target.value)}><option>Available</option><option>Away</option><option>Busy</option><option>Invisible</option></select></label><button className="primary-button" onClick={async()=>{localStorage.setItem('i2008-nickname',nickname);if(session){const {error}=await supabase.from('profiles').update({display_name:nickname,mood:statusText}).eq('id',session.user.id);if(error)return showNotice(error.message);}showNotice('Profile updated.');}}><UserCheck size={16}/> Save profile</button></div></div>}

          <div className="statusbar"><span><span className="tiny-online"/> Ready</span><span>{session ? `Signed in: ${nickname}` : 'Guest session'}</span><span>Internet 2008 v1.0</span></div>
        </section>
      )}

      {showStartMenu && <><button className="start-menu-dismiss" aria-label="Close Start menu" onClick={()=>setShowStartMenu(false)}/><section className="start-menu"><div className="start-menu-banner"><div className="start-menu-avatar">{(nickname||'I').slice(0,1).toUpperCase()}</div><div><b>{nickname||'Internet Guest'}</b><small>{session ? 'Online' : 'Guest session'}</small></div></div><div className="start-menu-body"><div className="start-menu-programs"><small className="start-menu-label">PINNED PROGRAMS</small>{[['messenger',MessageCircle,'Messenger'],['browser',Globe,'Internet Explorer']].map(([id,Icon,label])=><button key={id} onClick={()=>launchApp(id)}><Icon size={17}/><span>{label}</span></button>)}<div className="start-menu-recent"><small className="start-menu-label">RECENTLY USED</small>{recentApps.slice(0,3).map(id=><button key={id} onClick={()=>launchApp(id)}><Globe size={15}/><span>{{messenger:'Messenger',browser:'Internet Explorer'}[id]}</span></button>)}</div></div><div className="start-menu-links"><small className="start-menu-label">SYSTEM</small><button onClick={()=>{setShowStartMenu(false);setShowSettings(true);}}><Settings size={16}/> Control Panel</button><button onClick={()=>{setShowStartMenu(false);setShowActivityCenter(true);}}><Bell size={16}/> Activity Center</button><div className="start-menu-tip">Your little corner of the old internet.</div></div></div><div className="start-menu-footer"><span><span className="tiny-online"/>{connectionLabel}</span><button onClick={()=>{setShowStartMenu(false);if(session)signOut();else showNotice('You are already in guest mode.');}}><LogOut size={15}/> Log Off</button><button onClick={()=>{setShowStartMenu(false);setWindowMinimized(true);setShowActivityCenter(false);showNotice('Session paused. Your desktop is still here.');}}><LogOut size={15}/> Shut Down</button></div></section></>}

      {windowMinimized && <button className="restore-window" onClick={() => setWindowMinimized(false)}><MessageCircle size={16}/> {windowTitle}</button>}

      <footer className="taskbar"><button className={`start-button ${showStartMenu ? 'active' : ''}`} onClick={()=>setShowStartMenu(v=>!v)}><span className="start-orb"><Monitor size={16}/></span><b>Start</b></button><div className="taskbar-divider"/><button className={`taskbar-app ${activeApp==='messenger'?'active':''}`} onClick={()=>{setActiveApp('messenger');setMessengerView('home');setWindowMinimized(false);}}><MessageCircle size={15}/> Messenger</button><div className="taskbar-spacer"/><div className="system-tray"><span className="tray-status"><span className="tiny-online"/>{session?'Online':'Guest'}</span><span>{nowTime()}</span></div></footer>

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
