import { useState, useRef, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { ArrowLeft, Trash2, Edit2, Loader2, Check, X, Paperclip, Bookmark, Camera, ChevronRight, Download, MessageSquare, MessageCircle, Copy, Reply, Mic, Square, Play, RefreshCw, ArrowUp, Pin, Forward, LogOut, Bell, Send, Clock } from 'lucide-react';
import { io } from 'socket.io-client';
import { saveSecureData, loadSecureData } from '../cryptoDB';

let socket: any = null;
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const DOUBLE_NL = NL + NL;

const getUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}'); return u.id || u.userId || u._id || 1; } catch (e) { return 1; }
};

const FAST_REACTIONS = ['❤️', '👍', '🔥', '😂', '😢'];

const translations = {
  ru: {
    saved: "Избранное", companion: "Собеседник", attachment: "Вложение", photo: "Фотография",
    info: "Информация", name: "Название", desc: "Описание", bio: "О себе", channel: "Канал",
    personalChannel: "Личный Канал", birthday: "День рождения", online: "в сети", group: "Группа",
    subs: ['подписчик', 'подписчика', 'подписчиков'], members: ['участник', 'участника', 'участников'],
    onlineCount: "в сети", subscribe: "Подписаться", joinGroup: "Вступить в группу",
    mute: "Убрать звук", unmute: "Включить звук", reply: "Ответ", editing: "Редактирование",
    edited: "изменено", messagePlaceholder: "Сообщение", commentPlaceholder: "Комментарий...",
    deleteConfirm: "Удалить сообщение?", comments: "Комментарии", noComments: "Пока нет комментариев",
    commentsCount: ['комментарий', 'комментария', 'комментариев'], isTyping: "печатает...",
    areTyping: "печатают...", replyAction: "Ответить", copy: "Копировать", editAction: "Изменить",
    deleteAction: "Удалить", cancel: "ОТМЕНА", pin: "Закрепить", unpin: "Открепить",
    forward: "Переслать", pinnedMsg: "Закреплённое сообщение", forwardTitle: "Переслать в...",
    makeAdmin: "Сделать админом", dismissAdmin: "Разжаловать", deleteChat: "Удалить чат",
    leaveChat: "Покинуть чат", forwardedFrom: "Переслано от", writeBtn: "Написать",
    muteBtn: "Звук", leaveBtn: "Leave", mediaTab: "Медиа", membersTab: "Members",
    sendMedia: "Мои заметки", addCaption: "Добавить подпись..."
  },
  en: {
    saved: "Saved Messages", companion: "Companion", attachment: "Attachment", photo: "Photo",
    info: "Info", name: "Name", desc: "Описание", bio: "Bio", channel: "Channel",
    personalChannel: "Personal Channel", birthday: "Birthday", online: "online", group: "Group",
    subs: ['subscriber', 'subscribers'], members: ['member', 'members'], onlineCount: "online",
    subscribe: "Subscribe", joinGroup: "Join Group", mute: "Mute", unmute: "Unmute",
    reply: "Reply", editing: "Edit Message", edited: "edited", messagePlaceholder: "Message",
    commentPlaceholder: "Comment...", deleteConfirm: "Delete message?", comments: "Comments",
    noComments: "No comments yet", commentsCount: ['comment', 'comments', 'comments'],
    isTyping: "is typing...", areTyping: "are typing...", replyAction: "Reply", copy: "Copy",
    editAction: "Edit", deleteAction: "Delete", cancel: "CANCEL", pin: "Pin", unpin: "Unpin",
    forward: "Forward", pinnedMsg: "Pinned Message", forwardTitle: "Forward to...",
    makeAdmin: "Make Admin", dismissAdmin: "Dismiss Admin", deleteChat: "Delete Chat",
    leaveChat: "Leave Chat", forwardedFrom: "Forwarded from", writeBtn: "Write",
    muteBtn: "Mute", leaveBtn: "Leave", mediaTab: "Media", membersTab: "Members",
    sendMedia: "Send Media", addCaption: "Add a caption..."
  }
};

function declOfNum(n: number, text_forms: string[], lang: 'ru' | 'en') {
  n = Math.abs(n) % 100;
  if (lang === 'en') return n === 1 ? text_forms[0] : text_forms[1];
  const n1 = n % 10;
  if (n > 10 && n < 20) return text_forms[2];
  if (n1 > 1 && n1 < 5) return text_forms[1];
  if (n1 === 1) return text_forms[0];
  return text_forms[2];
}

const formatLastSeen = (timestamp: number, lang: 'ru' | 'en') => {
  if (!timestamp) return lang === 'ru' ? 'был(а) недавно' : 'last seen recently';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  const timeStr = date.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return lang === 'ru' ? `был(а) в ${timeStr}` : `last seen today at ${timeStr}`;
  if (isYesterday) return lang === 'ru' ? `был(а) вчера в ${timeStr}` : `last seen yesterday at ${timeStr}`;
  let dateStr = date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
  if (lang === 'ru') dateStr = dateStr.replace('.', '');
  return lang === 'ru' ? `был(а) ${dateStr} в ${timeStr}` : `last seen ${dateStr} at ${timeStr}`;
};

const isMsgRead = (msg: any, isSavedChat: boolean) => {
  if (isSavedChat) return true;
  if (!msg) return false;
  return msg.read === true || msg.read === 1 || msg.read === '1' || msg.isRead === true || msg.isRead === 1 || msg.isRead === '1' || msg.status === 'read' || msg.viewed === true;
};

const formatMsTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s},${milliseconds < 10 ? '0' : ''}${milliseconds}`;
};

const stripQuotedPrefix = (raw: string) => {
  if (!raw || typeof raw !== 'string') return '';
  const normalized = raw.split(CR).join('');
  if (normalized.startsWith('> ')) {
    const parts = normalized.split(DOUBLE_NL);
    return parts.slice(1).join(DOUBLE_NL);
  }
  return normalized;
};

const isMediaUrl = (word: string) => {
  const lower = word.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
  return lower.includes('cloudinary.com') || lower.includes('/upload/') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
};

const VoicePlayer = ({ url, isMe, timeStr, readStatus, isSaved, fixedDuration, isSending }: any) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(fixedDuration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => {
      const currentDur = fixedDuration || audio.duration;
      if (currentDur && isFinite(currentDur)) setProgress((audio.currentTime / currentDur) * 100);
    };
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    const onLoadedMetadata = () => {
      if (fixedDuration) return;
      if (audio.duration === Infinity) {
        audio.currentTime = 1e10;
        audio.addEventListener('seeked', function onLoadSeek() {
          audio.currentTime = 0; setDuration(audio.duration);
          audio.removeEventListener('seeked', onLoadSeek);
        });
      } else setDuration(audio.duration);
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [fixedDuration]);

  const togglePlay = (e: any) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const formatAudioTime = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const bars = [2, 4, 3, 5, 7, 8, 6, 4, 5, 3, 2, 4, 6, 5, 7, 8, 6, 4, 2, 3, 5, 4, 2];

  return (
    <div className="flex items-center gap-3 px-3 py-2 w-[260px]">
      <button onClick={togglePlay} className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isMe ? 'bg-white dark:bg-[#161618] text-[#1d1d1f] dark:text-[#f5f5f7]' : 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f]'}`}>
        {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-end gap-[2px] h-6 w-full opacity-80 mt-1">
          {bars.map((h, i) => (
            <div key={i} className={`w-[2.5px] rounded-full ${isMe ? 'bg-white/90 dark:bg-black/90' : 'bg-black/80 dark:bg-white/80'}`} style={{ height: `${(h / 8) * 100}%`, opacity: progress > (i / bars.length) * 100 ? 1 : 0.4 }}></div>
          ))}
        </div>
        <div className="flex justify-between items-center text-[11px] mt-1.5 opacity-70 font-medium">
          <span>{formatAudioTime(isPlaying ? audioRef.current?.currentTime || 0 : (fixedDuration || duration))}</span>
          <div className="flex items-center gap-1">
            <span>{timeStr}</span>
            {isMe && (
              isSending ? <Clock size={11} strokeWidth={2.5} className="animate-pulse" /> : <div className="flex -space-x-1"><Check size={11} strokeWidth={2.5} />{(readStatus || isSaved) && <Check size={11} strokeWidth={2.5} />}</div>
            )}
          </div>
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
};

export default function ChatPage() {
  const [, params] = useRoute('/chat/:chatId');
  const [, setLocation] = useLocation();
  const chatId = params?.chatId;
  const numericChatId = Number(chatId);
  const isGroupOrChannel = numericChatId >= 100000000;
  const isSavedChat = chatId === 'saved';
  const currentUserId = getUserId();
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mesbook_user') || '{}'); } catch (e) { return {}; } })();

  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [textSize, setTextSize] = useState(16);
  const [wallpaper, setWallpaper] = useState('');
  const [profileTab, setProfileTab] = useState<'members' | 'media'>(isGroupOrChannel && !isSavedChat ? 'members' : 'media');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  useEffect(() => {
    const savedSize = Number(localStorage.getItem('mesbook_text_size')) || 16;
    const savedWallpaper = localStorage.getItem('mesbook_wallpaper') || '';
    const savedTheme = localStorage.getItem('mesbook_theme') || localStorage.getItem('theme') || 'auto';
    setTextSize(savedSize);
    setWallpaper(savedWallpaper);
    if (savedTheme === 'dark' || (savedTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const [messages, setMessages] = useState<any[]>([]);
  const isFlushingRef = useRef(false);
  const outboxKey = `mesbook_outbox_${currentUserId}_${chatId}`;
  const cacheKey = isSavedChat ? `mesbook_saved_messages_${currentUserId}` : `mesbook_messages_cache_${currentUserId}_${chatId}`;

  // ЗАГРУЗКА СООБЩЕНИЙ И ОФФЛАЙН-ОЧЕРЕДИ ИЗ INDEXEDDB
  useEffect(() => {
    const fetchLocalEncryptedMessages = async () => {
      const decryptedData = await loadSecureData(cacheKey);
      const outboxData = isSavedChat ? [] : (await loadSecureData(outboxKey) || []);
      const baseMsgs = Array.isArray(decryptedData) ? decryptedData.map((m: any) => ({ ...m, isSending: false })) : [];
      const pendingMsgs = Array.isArray(outboxData) ? outboxData.map((m: any) => ({ ...m, isSending: true })) : [];
      if (baseMsgs.length > 0 || pendingMsgs.length > 0) {
        setMessages([...baseMsgs, ...pendingMsgs]);
      }
    };
    fetchLocalEncryptedMessages();
  }, [chatId, currentUserId, isSavedChat]);

  // СОХРАНЕНИЕ ПОДТВЕРЖДЕННЫХ СООБЩЕНИЙ В ЗАШИФРОВАННЫЙ КЭШ
  useEffect(() => {
    if (messages.length > 0) {
      const confirmedMsgs = messages.filter(m => !m.isSending);
      if (confirmedMsgs.length > 0 || isSavedChat) {
        saveSecureData(cacheKey, confirmedMsgs);
      }
    }
  }, [messages, chatId, currentUserId, isSavedChat]);

  // ФОНОВАЯ ДОСТАВКА ОФФЛАЙН-ОЧЕРЕДИ (LOCAL-FIRST)
  const flushOutbox = async () => {
    if (isSavedChat || isFlushingRef.current || !navigator.onLine) return;
    isFlushingRef.current = true;
    try {
      const queue: any[] = (await loadSecureData(outboxKey)) || [];
      if (queue.length === 0) { isFlushingRef.current = false; return; }
      const remaining: any[] = [];
      for (const item of queue) {
        try {
          const res = await fetch('/api/chats/' + chatId + '/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
            body: JSON.stringify({ content: item.content })
          });
          if (!res.ok) remaining.push(item);
        } catch (err) {
          remaining.push(item);
        }
      }
      await saveSecureData(outboxKey, remaining);
      if (remaining.length < queue.length) await loadData();
    } catch (e) {}
    isFlushingRef.current = false;
  };

  useEffect(() => {
    const onOnline = () => flushOutbox();
    window.addEventListener('online', onOnline);
    flushOutbox();
    return () => window.removeEventListener('online', onOnline);
  }, [chatId, currentUserId]);

  const [content, setContent] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [isUploading] = useState(false);

  // ЛАЙТБОКС С ЗУМОМ (PINCH-TO-ZOOM + DOUBLE TAP)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number, y: number, origX: number, origY: number } | null>(null);
  const lastTapPhotoRef = useRef<number>(0);

  const openLightbox = (url: string) => {
    setZoomScale(1);
    setZoomPos({ x: 0, y: 0 });
    setFullScreenImage(url);
    setContextMenu(null);
  };

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapPhotoRef.current < 280) {
        if (zoomScale > 1) { setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }
        else setZoomScale(2.5);
        lastTapPhotoRef.current = 0;
        return;
      }
      lastTapPhotoRef.current = now;
      if (zoomScale > 1) {
        panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, origX: zoomPos.x, origY: zoomPos.y };
      }
    }
  };

  const handleLightboxTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(4, Math.max(1, pinchStartScaleRef.current * (dist / pinchStartDistRef.current)));
      setZoomScale(newScale);
      if (newScale === 1) setZoomPos({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && zoomScale > 1 && panStartRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      setZoomPos({ x: panStartRef.current.origX + dx, y: panStartRef.current.origY + dy });
    }
  };

  const handleLightboxTouchEnd = () => {
    pinchStartDistRef.current = null;
    panStartRef.current = null;
    if (zoomScale < 1.05) { setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }
  };

  // СВАЙП ДЛЯ ОТВЕТА (ФИЗИКА ЖЕСТОВ)
  const [swipeState, setSwipeState] = useState<{ id: number | null, offset: number }>({ id: null, offset: 0 });
  const swipeTouchRef = useRef<{ id: number, x: number, y: number, item: any, locked: 'h' | 'v' | null, vibrated: boolean } | null>(null);

  const handleMsgSwipeStart = (e: React.TouchEvent, msg: any) => {
    if (e.touches.length !== 1) return;
    swipeTouchRef.current = { id: msg.id, x: e.touches[0].clientX, y: e.touches[0].clientY, item: msg, locked: null, vibrated: false };
  };

  const handleMsgSwipeMove = (e: React.TouchEvent) => {
    const st = swipeTouchRef.current;
    if (!st || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - st.x;
    const dy = e.touches[0].clientY - st.y;
    if (!st.locked) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) st.locked = 'h';
      else if (Math.abs(dy) > 8) st.locked = 'v';
    }
    if (st.locked === 'h' && dx < 0) {
      const offset = Math.max(-78, dx * 0.55);
      if (offset <= -52 && !st.vibrated) {
        st.vibrated = true;
        if (window.navigator?.vibrate) window.navigator.vibrate(20);
      } else if (offset > -52 && st.vibrated) {
        st.vibrated = false;
      }
      setSwipeState({ id: st.id, offset });
    }
  };

  const handleMsgSwipeEnd = () => {
    const st = swipeTouchRef.current;
    if (st && swipeState.id === st.id && swipeState.offset <= -52) {
      if (!isChannel) {
        setReplyingTo(st.item);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setActiveThread(st.item);
        loadComments(st.item.chatId || chatId, st.item.id);
      }
    }
    swipeTouchRef.current = null;
    if (swipeState.id !== null) setSwipeState({ id: null, offset: 0 });
  };

  const [contextMenu, setContextMenu] = useState<{ id: number, x: number, y: number, type: 'message' | 'comment', item: any } | null>(null);

  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [isCommentUploading, setIsCommentUploading] = useState(false);
  const [commentReplyingTo, setCommentReplyingTo] = useState<any>(null);

  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);
  const [forwardingMsg, setForwardingMsg] = useState<any>(null);
  const [chatListForForward, setChatListForForward] = useState<any[]>([]);

  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isMember, setIsMember] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [chatMembers, setChatMembers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingTime = useRef(0);

  const [isEditingChat, setIsEditingChat] = useState(false);
  const [editChatName, setEditChatName] = useState('');
  const [editChatDesc, setEditChatDesc] = useState('');
  const [editChatAvatar, setEditChatAvatar] = useState('');
  const [isSavingChat, setIsSavingChat] = useState(false);

  const [recordMode, setRecordMode] = useState<'voice' | 'video'>('voice');
  const [isAnimatingIcon, setIsAnimatingIcon] = useState(false);
  const [recordingType, setRecordingType] = useState<'voice' | 'video' | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);

  const cameraModeRef = useRef<'user' | 'environment'>('user');
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawFrameRef = useRef<number>();

  const [expandedVideoMsgId, setExpandedVideoMsgId] = useState<number | null>(null);
  const [uploadingMsgId, setUploadingMsgId] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const editAvatarRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const [chatInfo] = useState<any>(() => {
    if (isSavedChat) return { participant: { displayName: t.saved, isSaved: true } };
    try {
      const savedChats = JSON.parse(localStorage.getItem('mesbook_chats_' + currentUserId) || '[]');
      return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
    } catch (e) { return null; }
  });

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = isSavedChat ? t.saved : (chatInfo?.participant?.displayName || chatInfo?.name || savedName || t.companion);
  const isChannel = chatInfo?.participant?.isChannel;
  const isGroup = chatInfo?.participant?.isGroup && !isChannel;

  useEffect(() => {
    setProfileTab(isGroup && !isChannel ? 'members' : 'media');
  }, [isGroup, isChannel, showProfile]);

  useEffect(() => {
    const sendPing = async () => { try { await fetch('/api/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {} };
    sendPing();
    const interval = setInterval(sendPing, 10000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    if (!socket) socket = io(window.location.origin, { path: '/socket.io' });
    if (!isSavedChat) {
      socket.emit('join', String(chatId));
      const handleUpdate = (data?: any) => {
        const idToCheck = typeof data === 'object' && data !== null ? (data.chatId || data.id) : data;
        if (!idToCheck || String(idToCheck) === String(chatId) || Number(idToCheck) === Number(chatId)) loadData();
      };
      const handleTyping = (data: any) => {
        if (Number(data.chatId) === Number(chatId) && data.name !== chatInfo?.participant?.displayName) {
          setTypingUsers(prev => prev.includes(data.name) ? prev : [...prev, data.name]);
          setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== data.name)), 3000);
        }
      };
      const handleReconnect = () => flushOutbox();
      socket.on('connect', handleReconnect);
      socket.on('chat_update', handleUpdate);
      socket.on('message_read', handleUpdate);
      socket.on('messages_read', handleUpdate);
      socket.on('message', handleUpdate);
      socket.on('typing', handleTyping);
      return () => {
        socket.off('connect', handleReconnect);
        socket.off('chat_update', handleUpdate);
        socket.off('message_read', handleUpdate);
        socket.off('messages_read', handleUpdate);
        socket.off('message', handleUpdate);
        socket.off('typing', handleTyping);
      };
    }
  }, [chatId]);

  const loadComments = async (targetChatId: number, messageId: number) => {
    try {
      const commRes = await fetch(`/api/chats/${targetChatId}/messages/${messageId}/comments`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (commRes.ok) setThreadComments(await commRes.json());
    } catch (e) {}
  };

  const loadData = async () => {
    if (isSavedChat) {
      const saved = await loadSecureData('mesbook_saved_messages_' + currentUserId);
      if (saved && Array.isArray(saved)) setMessages(saved.map((m: any) => ({ ...m, isSending: false })));
      setIsLoadingRole(false);
      return;
    }
    if (isGroupOrChannel) {
      try {
        const roleRes = await fetch(`/api/chats/${chatId}/is_member`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          setIsMember(roleData.isMember);
          setIsAdmin(roleData.role === 'admin');
          setMembersCount(roleData.membersCount || 1);
          setOnlineCount(roleData.onlineCount || 1);
        }
        const membersRes = await fetch(`/api/chats/${chatId}/members`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (membersRes.ok) setChatMembers(await membersRes.json());
      } catch (e) {}
    }
    setIsLoadingRole(false);
    try { await fetch('/api/chats/' + chatId + '/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {}
    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (msgRes.ok) {
        const data = await msgRes.json();
        const serverMsgs = Array.isArray(data.messages) ? data.messages : [];
        const pendingOutbox = (await loadSecureData(outboxKey)) || [];
        setMessages([...serverMsgs, ...pendingOutbox.map((m: any) => ({ ...m, isSending: true }))]);
        if (data.pinnedMessage) {
          setPinnedMessages(prev => prev.find(m => m.id === data.pinnedMessage.id) ? prev : [...prev, data.pinnedMessage]);
        }
      }
    } catch (e) {}
    if (activeThread) loadComments(activeThread.chatId || chatId, activeThread.id);
  };

  useEffect(() => { loadData(); }, [chatId, activeThread]);

  const forceScrollToBottom = () => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 10); };
  useEffect(() => { forceScrollToBottom(); }, [messages.length]);

  useEffect(() => {
    if (commentsScrollRef.current && threadComments.length > 0) {
      commentsScrollRef.current.scrollTop = commentsScrollRef.current.scrollHeight;
    }
  }, [threadComments]);

  const animateTimer = () => {
    setRecordingMs(Date.now() - startTimeRef.current);
    requestRef.current = requestAnimationFrame(animateTimer);
  };

  const startRecording = async (type: 'voice' | 'video', mode: 'user' | 'environment' = 'user') => {
    try {
      setRecordingType(type);
      if (type === 'voice') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options: any = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
        else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };

        const recorder = new MediaRecorder(stream, options);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = async () => {
          const realDuration = (Date.now() - startTimeRef.current) / 1000;
          const mimeType = recorder.mimeType || 'audio/webm';
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          stream.getTracks().forEach(tr => tr.stop());
          const tempId = Date.now();
          setUploadingMsgId(tempId);
          setMessages((prev: any) => [...prev, { id: tempId, content: '[VOICE] loading', isSending: true, senderId: currentUserId, createdAt: new Date().toISOString(), read: false }]);
          forceScrollToBottom();

          const formData = new FormData();
          formData.append('file', blob, `voice.${ext}`);
          formData.append('upload_preset', 'mesogram-cloud');
          formData.append('resource_type', 'auto');
          try {
            const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.secure_url) {
              setMessages((prev: any) => prev.filter((m: any) => m.id !== tempId));
              sendDirectMessage(`[VOICE] ${data.secure_url} D:${realDuration.toFixed(1)}`);
            }
          } catch (e) { setMessages((prev: any) => prev.filter((m: any) => m.id !== tempId)); }
          setUploadingMsgId(null);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        startTimeRef.current = Date.now();
        requestRef.current = requestAnimationFrame(animateTimer);
      } else {
        cameraModeRef.current = mode;
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
        setTimeout(() => {
          if (!hiddenVideoRef.current || !canvasRef.current) return;
          hiddenVideoRef.current.srcObject = videoStream;
          hiddenVideoRef.current.muted = true;
          hiddenVideoRef.current.play().catch(() => {});
          const ctx = canvasRef.current.getContext('2d');
          const drawFrame = () => {
            if (ctx && hiddenVideoRef.current && hiddenVideoRef.current.readyState >= 2) {
              const video = hiddenVideoRef.current;
              const size = Math.min(video.videoWidth, video.videoHeight);
              const x = (video.videoWidth - size) / 2;
              const y = (video.videoHeight - size) / 2;
              ctx.save();
              ctx.clearRect(0, 0, 240, 240);
              if (cameraModeRef.current === 'user') { ctx.translate(240, 0); ctx.scale(-1, 1); }
              ctx.drawImage(video, x, y, size, size, 0, 0, 240, 240);
              ctx.restore();
            }
            drawFrameRef.current = requestAnimationFrame(drawFrame);
          };
          drawFrame();
          let canvasStream;
          try { canvasStream = (canvasRef.current as any).captureStream(30); } catch (e) { canvasStream = videoStream; }
          const combinedStream = new MediaStream([canvasStream.getVideoTracks()[0], audioStream.getAudioTracks()[0]]);
          let options: any = {};
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) options = { mimeType: 'video/webm;codecs=vp8,opus' };
          else if (MediaRecorder.isTypeSupported('video/mp4')) options = { mimeType: 'video/mp4' };

          const recorder = new MediaRecorder(combinedStream, options);
          chunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          recorder.onstop = async () => {
            const realDuration = (Date.now() - startTimeRef.current) / 1000;
            const mimeType = recorder.mimeType || 'video/webm';
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(chunksRef.current, { type: mimeType });
            audioStream.getTracks().forEach(tr => tr.stop());
            videoStream.getTracks().forEach(tr => tr.stop());
            const currentVidStream = hiddenVideoRef.current?.srcObject as MediaStream;
            currentVidStream?.getTracks().forEach(tr => tr.stop());
            if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current);

            const tempId = Date.now();
            setUploadingMsgId(tempId);
            setMessages((prev: any) => [...prev, { id: tempId, content: '[VIDEO_NOTE] loading', isSending: true, senderId: currentUserId, createdAt: new Date().toISOString(), read: false }]);
            forceScrollToBottom();

            const formData = new FormData();
            formData.append('file', blob, `video.${ext}`);
            formData.append('upload_preset', 'mesogram-cloud');
            formData.append('resource_type', 'video');
            try {
              const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.secure_url) {
                setMessages((prev: any) => prev.filter((m: any) => m.id !== tempId));
                sendDirectMessage(`[VIDEO_NOTE] ${data.secure_url} D:${realDuration.toFixed(1)}`);
              }
            } catch (e) { setMessages((prev: any) => prev.filter((m: any) => m.id !== tempId)); }
            setUploadingMsgId(null);
          };
          recorder.start();
          mediaRecorderRef.current = recorder;
          startTimeRef.current = Date.now();
          requestRef.current = requestAnimationFrame(animateTimer);
        }, 100);
      }
    } catch (e) {
      alert('Необходим доступ к микрофону и/или камере');
      setRecordingType(null);
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current?.stream.getTracks().forEach(tr => tr.stop()); };
      mediaRecorderRef.current.stop();
    } else if (cancel && mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(tr => tr.stop());
    }
    setRecordingType(null);
  };

  const toggleCamera = async () => {
    const newMode = cameraModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: newMode } } }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode } }));
      cameraModeRef.current = newMode;
      const oldStream = hiddenVideoRef.current?.srcObject as MediaStream;
      oldStream?.getVideoTracks().forEach(tr => tr.stop());
      if (hiddenVideoRef.current) { hiddenVideoRef.current.srcObject = newStream; hiddenVideoRef.current.play().catch(() => {}); }
    } catch (e) {}
  };

  const handleRecordTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    holdTimerRef.current = setTimeout(() => { startRecording(recordMode, cameraModeRef.current); holdTimerRef.current = null; }, 300);
  };

  const handleRecordTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setIsAnimatingIcon(true);
      setTimeout(() => { setRecordMode(p => p === 'voice' ? 'video' : 'voice'); setIsAnimatingIcon(false); }, 150);
    }
  };

  // ОПТИМИСТИЧНАЯ ОТПРАВКА С ОФФЛАЙН-ОЧЕРЕДЬЮ
  const sendDirectMessage = async (msgContent: string) => {
    const tempMsg = { id: Date.now() + Math.floor(Math.random() * 1000), content: msgContent, isSending: true, senderId: currentUserId, senderName: currentUser?.displayName, createdAt: new Date().toISOString(), read: false };
    if (isSavedChat) {
      const currentSaved = await loadSecureData(`mesbook_saved_messages_${currentUserId}`) || [];
      const updatedSaved = [...currentSaved, { ...tempMsg, isSending: false }];
      setMessages(updatedSaved);
      saveSecureData(`mesbook_saved_messages_${currentUserId}`, updatedSaved);
      forceScrollToBottom();
      return;
    }

    setMessages((prev: any) => [...prev, tempMsg]);
    forceScrollToBottom();

    const currentOutbox = (await loadSecureData(outboxKey)) || [];
    await saveSecureData(outboxKey, [...currentOutbox, tempMsg]);

    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify({ content: msgContent })
      });
      if (res.ok) {
        const latestOutbox = (await loadSecureData(outboxKey)) || [];
        await saveSecureData(outboxKey, latestOutbox.filter((m: any) => m.id !== tempMsg.id));
        loadData();
      }
    } catch (error) {
      // Остается в зашифрованном outbox со значком часиков до появления сети
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (editingMsg) {
      const newTextContent = content.trim();
      let finalEditedContent = newTextContent;
      if (editingMsg.content.startsWith('> ')) {
        const parts = editingMsg.content.split(DOUBLE_NL);
        finalEditedContent = `${parts[0]}${DOUBLE_NL}${newTextContent}`;
      }
      setContent(''); setEditingMsg(null);
      try { await fetch(`/api/chats/${chatId}/messages/${editingMsg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalEditedContent }) }); loadData(); } catch (e) {}
      return;
    }
    const tempContent = content.trim();
    const finalContent = replyingTo ? `> ${stripQuotedPrefix(replyingTo.content)}${DOUBLE_NL}${tempContent}` : tempContent;
    setContent(''); setReplyingTo(null);
    sendDirectMessage(finalContent);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !activeThread) return;
    const tempContent = commentContent.trim();
    const finalContent = commentReplyingTo ? `> ${stripQuotedPrefix(commentReplyingTo.content)}${DOUBLE_NL}${tempContent}` : tempContent;
    setCommentContent(''); setCommentReplyingTo(null);
    try {
      const targetChatId = activeThread.chatId || chatId;
      await fetch(`/api/chats/${targetChatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalContent, parentId: activeThread.id }) });
      loadComments(targetChatId, activeThread.id);
    } catch (error) {}
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setMediaPreviews(files.map(file => URL.createObjectURL(file)));
    setMediaCaption('');
  };

  const handleConfirmMediaUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploadingMedia(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'mesogram-cloud');
        const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) uploadedUrls.push(data.secure_url);
      }
      if (uploadedUrls.length > 0) {
        let finalContent = uploadedUrls.map(url => `[MEDIA] ${url}`).join(NL);
        if (mediaCaption.trim()) finalContent += `${DOUBLE_NL}${mediaCaption.trim()}`;
        sendDirectMessage(finalContent);
      }
    } catch (err) {} finally {
      setIsUploadingMedia(false); setSelectedFiles([]); setMediaPreviews([]); setMediaCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeThread) return;
    setIsCommentUploading(true);
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', 'mesogram-cloud');
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        const targetChatId = activeThread.chatId || chatId;
        await fetch(`/api/chats/${targetChatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: `[MEDIA] ${data.secure_url}`, parentId: activeThread.id }) });
        loadComments(targetChatId, activeThread.id);
      }
    } catch (err: any) {} finally { setIsCommentUploading(false); if (commentFileInputRef.current) commentFileInputRef.current.value = ''; }
  };

  const togglePin = async (msg: any) => {
    setContextMenu(null);
    const isPinned = pinnedMessages.some(m => m.id === msg.id);
    if (isPinned) {
      setPinnedMessages(prev => prev.filter(m => m.id !== msg.id));
      if (activePinnedIndex >= pinnedMessages.length - 1) setActivePinnedIndex(Math.max(0, pinnedMessages.length - 2));
    } else {
      setPinnedMessages(prev => [...prev, msg]);
      setActivePinnedIndex(pinnedMessages.length);
    }
    try {
      await fetch(`/api/chats/${chatId}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ messageId: isPinned ? null : msg.id }) });
    } catch (e) {}
  };

  const openForwardModal = (msg: any) => {
    setContextMenu(null); setForwardingMsg(msg);
    try { setChatListForForward(JSON.parse(localStorage.getItem('mesbook_chats_' + currentUserId) || '[]')); } catch (e) {}
  };

  const handleForward = async (targetChatId: string) => {
    if (!forwardingMsg) return;
    const contentToForward = `> ${t.forwardedFrom} ${forwardingMsg.senderName || t.companion}${DOUBLE_NL}${forwardingMsg.content}`;
    setForwardingMsg(null);
    try {
      await fetch(`/api/chats/${targetChatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: contentToForward }) });
    } catch (e) {}
  };

  const toggleAdmin = async (userId: string | number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    setChatMembers(prev => prev.map(m => String(m.id) === String(userId) ? { ...m, role: newRole } : m));
    try {
      await fetch(`/api/chats/${chatId}/members/${userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ role: newRole }) });
    } catch (e) {}
  };

  const leaveOrDeleteChat = async () => {
    if (!window.confirm(isGroupOrChannel ? t.leaveChat + '?' : t.deleteChat + '?')) return;
    try {
      await fetch(`/api/chats/${chatId}/${isGroupOrChannel ? 'leave' : 'delete'}`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } });
      setLocation('/');
    } catch (e) {}
  };

  const toggleReaction = async (msgId: number, reaction: string, isComment = false) => {
    setContextMenu(null);
    const updateFn = (item: any) => {
      const newR = { ...(item.reactions || {}) };
      if (item.myReaction === reaction) {
        if (newR[reaction]) newR[reaction].count = Math.max(0, newR[reaction].count - 1);
        if (newR[reaction]?.count === 0) delete newR[reaction];
        return { ...item, reactions: newR, myReaction: null };
      } else {
        if (item.myReaction && newR[item.myReaction]) {
          newR[item.myReaction].count = Math.max(0, newR[item.myReaction].count - 1);
          if (newR[item.myReaction].count === 0) delete newR[item.myReaction];
        }
        if (!newR[reaction]) newR[reaction] = { count: 0, users: [] };
        newR[reaction].count++;
        if (currentUser) {
          const userObj = { id: currentUserId, name: currentUser.displayName || 'U', avatar: currentUser.avatarUrl };
          newR[reaction].users = [userObj, ...(newR[reaction].users || []).filter((u: any) => u.id !== currentUserId)];
        }
        return { ...item, reactions: newR, myReaction: reaction };
      }
    };
    if (isComment) setThreadComments(prev => prev.map(c => c.id === msgId ? updateFn(c) : c));
    else setMessages(prev => prev.map(m => m.id === msgId ? updateFn(m) : m));
    try {
      const targetChatId = isComment && activeThread ? (activeThread.chatId || chatId) : chatId;
      await fetch(`/api/chats/${targetChatId}/messages/${msgId}/reaction`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ reaction }) });
    } catch (e) {}
  };

  const deleteMessage = async (msgId: number, isComment = false) => {
    try {
      if (!isComment) {
        const latestOutbox = (await loadSecureData(outboxKey)) || [];
        if (latestOutbox.some((m: any) => m.id === msgId)) {
          await saveSecureData(outboxKey, latestOutbox.filter((m: any) => m.id !== msgId));
          setMessages(prev => prev.filter(m => m.id !== msgId));
          return;
        }
      }
      const targetChatId = isComment && activeThread ? (activeThread.chatId || chatId) : chatId;
      await fetch(`/api/chats/${targetChatId}/messages/${msgId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (isComment && activeThread) loadComments(targetChatId, activeThread.id);
      else loadData();
    } catch (e) {}
  };

  const openGlobalMenu = (e: React.MouseEvent | React.TouchEvent, item: any, type: 'message' | 'comment') => {
    e.stopPropagation();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setContextMenu({ id: item.id, x: clientX, y: clientY, type, item });
  };

  const handleTouchStartPhoto = (e: React.TouchEvent | React.MouseEvent, item: any, type: 'message' | 'comment') => {
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      if (window.navigator?.vibrate) window.navigator.vibrate(35);
      setContextMenu({ id: item.id, x: clientX, y: clientY, type, item });
    }, 450);
  };

  const clearPhotoTimer = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const joinChat = async () => {
    try { await fetch(`/api/chats/${chatId}/join`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); setIsMember(true); loadData(); } catch (e) {}
  };

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl; link.download = `mesogram_photo_${Date.now()}.jpg`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (e) { window.open(url, '_blank'); }
  };

  const startEditing = (msg: any) => {
    setEditingMsg(msg);
    setContent(msg.content.startsWith('> ') ? msg.content.split(DOUBLE_NL).slice(1).join(DOUBLE_NL) : msg.content);
    setReplyingTo(null);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleEditChatClick = () => {
    setEditChatName(chatInfo?.participant?.displayName || '');
    setEditChatDesc(chatInfo?.participant?.description || chatInfo?.participant?.bio || '');
    setEditChatAvatar(chatInfo?.participant?.avatarUrl || '');
    setIsEditingChat(true);
  };

  const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSavingChat(true);
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', 'mesogram-cloud');
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) setEditChatAvatar(data.secure_url);
    } catch (err) {}
    setIsSavingChat(false);
  };

  const handleSaveChatSettings = async () => {
    setIsSavingChat(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editChatName, description: editChatDesc, avatarUrl: editChatAvatar }) });
      if (res.ok) { setIsEditingChat(false); loadData(); }
    } catch (e) {}
    setIsSavingChat(false);
  };

  const parseContent = (rawText: any) => {
    if (!rawText || typeof rawText !== 'string') {
      return { text: '', quotedText: null, mediaUrls: [], hasMedia: false, hasText: false, isVideo: false, voiceUrl: null, videoNoteUrl: null, fixedDuration: null };
    }
    let text = rawText.split(CR).join('');
    let voiceUrl: string | null = null;
    let videoNoteUrl: string | null = null;
    let fixedDuration: number | null = null;
    const mediaUrls: string[] = [];

    try {
      const lines = text.split(NL);
      const cleanLines: string[] = [];

      for (const line of lines) {
        const words = line.split(' ');
        const cleanWords: string[] = [];
        let expectVoice = false;
        let expectVideoNote = false;

        for (const word of words) {
          const trimmed = word.trim();
          if (!trimmed) continue;

          if (trimmed === '[VOICE]') { expectVoice = true; continue; }
          if (trimmed === '[VIDEO_NOTE]') { expectVideoNote = true; continue; }
          if (trimmed === '[MEDIA]' || trimmed === '[media]' || trimmed === '[]') continue;

          if (trimmed.startsWith('D:') && trimmed.length <= 8) {
            const dVal = parseFloat(trimmed.slice(2));
            if (!isNaN(dVal)) fixedDuration = dVal;
            continue;
          }

          if (expectVoice && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed === 'loading')) {
            voiceUrl = trimmed; expectVoice = false; continue;
          }
          if (expectVideoNote && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed === 'loading')) {
            videoNoteUrl = trimmed; expectVideoNote = false; continue;
          }

          if (trimmed.startsWith('[MEDIA]http')) {
            const u = trimmed.slice(7).trim();
            if (u && !mediaUrls.includes(u)) mediaUrls.push(u);
            continue;
          }

          if (isMediaUrl(trimmed)) {
            if (!mediaUrls.includes(trimmed)) mediaUrls.push(trimmed);
            continue;
          }

          cleanWords.push(word);
        }

        const joined = cleanWords.join(' ').trim();
        if (joined) cleanLines.push(joined);
      }

      text = cleanLines.join(NL).trim();
    } catch (e) {}

    let quotedText: string | null = null;
    try {
      if (text.startsWith('> ')) {
        const parts = text.split(DOUBLE_NL);
        if (parts.length > 0) {
          quotedText = parts[0].slice(2).trim();
          text = parts.slice(1).join(DOUBLE_NL).trim();
        }
      }
    } catch (e) {}

    const hasMedia = mediaUrls.length > 0;
    const hasText = Boolean(text) || Boolean(quotedText);
    const firstUrl = mediaUrls[0] ? mediaUrls[0].toLowerCase() : '';
    const isVideo = hasMedia && (firstUrl.endsWith('.mp4') || firstUrl.endsWith('.webm') || firstUrl.endsWith('.mov') || firstUrl.endsWith('.ogg') || firstUrl.includes('/video/upload/'));

    return { text, quotedText, mediaUrls, hasMedia, hasText, isVideo, voiceUrl, videoNoteUrl, fixedDuration };
  };

  const lastSeen = chatInfo?.participant?.lastSeen;
  const isOnline = lastSeen ? (Date.now() - lastSeen < 30000) : false;
  let subtitleText = "";
  let subtitleColor = "text-[#86868b] dark:text-[#98989d]";

  if (typingUsers.length > 0) {
    subtitleText = typingUsers.length === 1 ? (isGroupOrChannel ? `${typingUsers[0]} ${t.isTyping}` : t.isTyping) : `${typingUsers.join(', ')} ${t.areTyping}`;
  } else if (!isSavedChat) {
    if (isGroupOrChannel) {
      if (membersCount === null) subtitleText = isChannel ? t.channel : t.group;
      else subtitleText = isChannel ? `${membersCount} ${declOfNum(membersCount, t.subs, lang)}` : `${membersCount} ${declOfNum(membersCount, t.members, lang)}, ${onlineCount || 1} ${t.onlineCount}`;
    } else {
      subtitleColor = isOnline ? 'text-[#1d1d1f] dark:text-[#f5f5f7] font-medium' : 'text-[#86868b] dark:text-[#98989d]';
      subtitleText = isOnline ? t.online : formatLastSeen(lastSeen, lang);
    }
  }

  const chatMedia = messages.reduce((acc: string[], msg: any) => {
    const { mediaUrls, videoNoteUrl } = parseContent(msg.content);
    if (mediaUrls && mediaUrls.length > 0) acc.push(...mediaUrls);
    if (videoNoteUrl) acc.push(videoNoteUrl);
    return acc;
  }, []).reverse();

  const activeThreadContent = activeThread ? parseContent(activeThread.content) : null;
  const currentPinnedMsg = pinnedMessages[activePinnedIndex] || pinnedMessages[0];

  return (
    <div
      className={`flex flex-col h-[100dvh] transition-colors duration-300 relative font-sans overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20 animate-in slide-in-from-right-8 fade-in duration-300 ease-out ${!wallpaper ? 'bg-[#f5f5f7] dark:bg-[#161618]' : ''}`}
      style={wallpaper ? { background: wallpaper.startsWith('#') ? wallpaper : `url(${wallpaper}) center/cover fixed` } : {}}
      onClick={() => setContextMenu(null)}
    >
      {/* МОДАЛКА МУЛЬТИЗАГРУЗКИ ФОТО */}
      {selectedFiles.length > 0 && (
        <div className="fixed inset-0 z-[400] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => { setSelectedFiles([]); setMediaPreviews([]); }} className="p-2 text-white active:scale-95 transition-transform"><ArrowLeft size={24} /></button>
              <span className="font-semibold text-[18px] text-white">Выбрано {selectedFiles.length}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black mt-16">
            <img src={mediaPreviews[0]} className="max-w-full max-h-full object-contain" />
          </div>
          <div className="bg-[#1c1c1e] w-full rounded-t-[20px] flex flex-col">
            {mediaPreviews.length > 1 && (
              <div className="p-3 overflow-x-auto flex gap-2 scrollbar-hide border-b border-white/10">
                {mediaPreviews.map((src, idx) => (
                  <div key={idx} className="w-[60px] h-[60px] rounded-[8px] overflow-hidden shrink-0 relative bg-black/50">
                    <img src={src} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute top-1 right-1 w-[18px] h-[18px] bg-white rounded-full flex items-center justify-center border-2 border-[#1c1c1e]"><Check size={12} className="text-[#1c1c1e]" strokeWidth={3} /></div>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 flex items-center gap-3">
              <input type="text" value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder={t.addCaption} className="flex-1 bg-transparent text-[16px] text-white outline-none placeholder-gray-400 py-2" />
              <button onClick={handleConfirmMediaUpload} disabled={isUploadingMedia} className="w-[42px] h-[42px] shrink-0 bg-white rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                {isUploadingMedia ? <Loader2 size={20} className="animate-spin text-[#1c1c1e]" /> : <Send size={18} className="text-[#1c1c1e] ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ЗАПИСЬ ВИДЕОКРУЖОЧКА */}
      {recordingType === 'video' && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full overflow-hidden border-[3px] border-[#1d1d1f] dark:border-[#f5f5f7] shadow-2xl z-[100] animate-in zoom-in duration-200 bg-black">
          <video ref={hiddenVideoRef} playsInline muted autoPlay className="hidden" />
          <canvas ref={canvasRef} width={240} height={240} className="w-full h-full object-cover rounded-full" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-full animate-pulse shadow-sm" />
        </div>
      )}

      {/* ПЕРЕСЫЛКА */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200" onClick={() => setForwardingMsg(null)}>
          <div className="bg-[#f5f5f7] dark:bg-[#161618] w-full rounded-t-[24px] overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-white dark:bg-[#222224]">
              <span className="font-semibold text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">{t.forwardTitle}</span>
              <button onClick={() => setForwardingMsg(null)} className="p-1 active:scale-95 text-[#86868b]"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {chatListForForward.map(c => (
                <div key={c.id} onClick={() => handleForward(c.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-[16px] cursor-pointer transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#e5e5ea] dark:bg-[#333336] overflow-hidden flex items-center justify-center shrink-0 font-medium text-[16px]">
                    {c.participant?.avatarUrl ? <img src={c.participant.avatarUrl} className="w-full h-full object-cover" /> : c.participant?.displayName?.charAt(0)}
                  </div>
                  <span className="font-medium text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7]">{c.participant?.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ЛАЙТБОКС С ПОДДЕРЖКОЙ ЗУМА (PINCH-TO-ZOOM & DOUBLE TAP) */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200 ease-out touch-none"
          onTouchStart={handleLightboxTouchStart}
          onTouchMove={handleLightboxTouchMove}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <div className="flex items-center justify-between p-4 pt-10 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-20">
            <button onClick={() => setFullScreenImage(null)} className="p-2.5 text-white bg-white/10 rounded-full backdrop-blur-md active:scale-90 transition-transform"><X size={22} /></button>
            <button onClick={() => downloadImage(fullScreenImage)} className="p-2.5 text-white bg-white/10 rounded-full backdrop-blur-md active:scale-90 transition-transform"><Download size={22} /></button>
          </div>
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onClick={() => { if (zoomScale === 1) setFullScreenImage(null); }}
          >
            <img
              src={fullScreenImage}
              alt="Media"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => { if (zoomScale > 1) { setZoomScale(1); setZoomPos({ x: 0, y: 0 }); } else setZoomScale(2.5); }}
              style={{
                transform: `translate3d(${zoomPos.x}px, ${zoomPos.y}px, 0) scale(${zoomScale})`,
                transition: pinchStartDistRef.current || panStartRef.current ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
              }}
              className="max-w-full max-h-full object-contain select-none"
            />
          </div>
        </div>
      )}

      {/* ПРОФИЛЬ ЧАТА / КАНАЛА */}
      {showProfile && chatInfo?.participant && (
        <div className="fixed inset-0 z-[150] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out overflow-y-auto">
          <header className="flex items-center justify-between px-4 pt-12 pb-2 sticky top-0 bg-[#f5f5f7]/90 dark:bg-[#161618]/90 backdrop-blur-xl z-20">
            <button onClick={() => { setShowProfile(false); setIsEditingChat(false); }} className="text-[#1d1d1f] dark:text-[#f5f5f7] p-2 -ml-2 transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2.5} /></button>
            {isAdmin && !isEditingChat && <button onClick={handleEditChatClick} className="text-[#1d1d1f] dark:text-[#f5f5f7] p-2 -mr-2 transition-transform active:scale-95"><Edit2 size={24} strokeWidth={2.5} /></button>}
            {isEditingChat && (
              <button onClick={handleSaveChatSettings} disabled={isSavingChat} className="text-[#1d1d1f] dark:text-[#f5f5f7] p-2 -mr-2 transition-transform active:scale-95">
                {isSavingChat ? <Loader2 size={24} className="animate-spin" /> : <Check size={26} strokeWidth={2.5} />}
              </button>
            )}
          </header>

          {isEditingChat ? (
            <div className="px-4 pt-4 w-full max-w-lg mx-auto flex flex-col gap-5">
              <div className="flex justify-center mb-4">
                <div className="w-[120px] h-[120px] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] bg-[#222224] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 relative cursor-pointer" onClick={() => editAvatarRef.current?.click()}>
                  {editChatAvatar && editChatAvatar.length > 5 ? <img src={editChatAvatar} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Camera size={36} className="text-white opacity-80" />}
                  {isSavingChat && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={24} className="text-white animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*" className="hidden" ref={editAvatarRef} onChange={handleEditAvatarUpload} />
              </div>
              <div className="bg-white dark:bg-[#222224] rounded-[24px] overflow-hidden border border-black/5 dark:border-white/5">
                <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
                  <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mt-1">{t.name}</label>
                  <input type="text" value={editChatName} onChange={e => setEditChatName(e.target.value)} className="w-full bg-transparent py-1.5 text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
                </div>
                <div className="px-5 py-4">
                  <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-2">{t.desc}</label>
                  <textarea rows={4} value={editChatDesc} onChange={e => setEditChatDesc(e.target.value)} className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center pt-2 pb-4">
              <div className="w-[100px] h-[100px] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center overflow-hidden mb-3">
                {chatInfo.participant.avatarUrl && chatInfo.participant.avatarUrl.length > 5 ? <img src={chatInfo.participant.avatarUrl} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span className="text-[36px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{chatInfo.participant.displayName?.charAt(0).toUpperCase()}</span>}
              </div>
              <h2 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] px-4 text-center tracking-tight">{chatInfo.participant.displayName}</h2>
              <p className={`text-[14px] mt-1 ${subtitleColor}`}>{subtitleText}</p>

              <div className="flex justify-center gap-2 px-4 mt-6 w-full max-w-lg">
                {!isChannel && (
                  <div className="flex flex-col items-center justify-center w-[80px] h-[70px] bg-[#e5e5ea] dark:bg-[#222224] rounded-[16px] cursor-pointer active:scale-95 transition-transform" onClick={() => setShowProfile(false)}>
                    <MessageSquare size={22} className="mb-1 text-[#1d1d1f] dark:text-[#f5f5f7]" />
                    <span className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{t.writeBtn}</span>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center w-[80px] h-[70px] bg-[#e5e5ea] dark:bg-[#222224] rounded-[16px] cursor-pointer active:scale-95 transition-transform" onClick={() => setIsMuted(!isMuted)}>
                  <Bell size={22} className={`mb-1 ${isMuted ? 'opacity-50' : ''} text-[#1d1d1f] dark:text-[#f5f5f7]`} />
                  <span className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{t.muteBtn}</span>
                </div>
                {isGroupOrChannel && (
                  <div className="flex flex-col items-center justify-center w-[80px] h-[70px] bg-[#e5e5ea] dark:bg-[#222224] rounded-[16px] cursor-pointer active:scale-95 transition-transform" onClick={leaveOrDeleteChat}>
                    <LogOut size={22} className="mb-1 text-[#1d1d1f] dark:text-[#f5f5f7]" />
                    <span className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{t.leaveBtn}</span>
                  </div>
                )}
              </div>

              {(!isGroupOrChannel || isChannel) && (
                <div className="px-4 mt-6 w-full max-w-lg">
                  <div className="bg-white dark:bg-[#222224] rounded-[20px] p-4 flex flex-col gap-4 border border-black/5 dark:border-white/5">
                    {isChannel ? (
                      chatInfo.participant.description && (
                        <div className="flex flex-col">
                          <span className="text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">{chatInfo.participant.description}</span>
                          <span className="text-[13px] text-[#86868b] dark:text-[#98989d] mt-1">{t.desc}</span>
                        </div>
                      )
                    ) : (
                      <>
                        {chatInfo.participant.username && (
                          <div className="flex flex-col">
                            <span className="text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">{chatInfo.participant.username}</span>
                            <span className="text-[13px] text-[#86868b] dark:text-[#98989d] mt-1">Никнейм (@username)</span>
                          </div>
                        )}
                        {chatInfo.participant.bio && (
                          <div className="flex flex-col">
                            <span className="text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">{chatInfo.participant.bio}</span>
                            <span className="text-[13px] text-[#86868b] dark:text-[#98989d] mt-1">{t.bio}</span>
                          </div>
                        )}
                        {chatInfo.participant.birthDate && (
                          <div className="flex flex-col">
                            <span className="text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">{new Date(chatInfo.participant.birthDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="text-[13px] text-[#86868b] dark:text-[#98989d] mt-1">{t.birthday}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="w-full max-w-lg mt-6">
                {isGroup && !isChannel ? (
                  <div className="flex px-6 gap-6 border-b border-black/5 dark:border-white/5 mb-4">
                    <button onClick={() => setProfileTab('members')} className={`pb-3 text-[15px] font-medium transition-colors relative ${profileTab === 'members' ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b]'}`}>
                      {t.membersTab}
                      {profileTab === 'members' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-t-full"></div>}
                    </button>
                    <button onClick={() => setProfileTab('media')} className={`pb-3 text-[15px] font-medium transition-colors relative ${profileTab === 'media' ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b]'}`}>
                      {t.mediaTab}
                      {profileTab === 'media' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-t-full"></div>}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center border-b border-black/5 dark:border-white/5 mb-4 px-6">
                    <button className="pb-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] relative">
                      {t.mediaTab}
                      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-t-full"></div>
                    </button>
                  </div>
                )}

                <div className="px-4 pb-10 w-full">
                  {profileTab === 'members' && isGroup && !isChannel && (
                    <div className="flex flex-col bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden border border-black/5 dark:border-white/5">
                      {chatMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 border-b border-black/5 dark:border-white/5 last:border-0">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-11 h-11 rounded-full bg-[#e5e5ea] dark:bg-[#333336] shrink-0 flex items-center justify-center font-medium text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] overflow-hidden">
                              {member.avatarUrl ? <img src={member.avatarUrl} className="w-full h-full object-cover" /> : member.displayName?.charAt(0)}
                            </div>
                            <div className="flex flex-col truncate pr-2">
                              <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate flex items-center gap-1.5">
                                {member.displayName}
                                {member.role === 'admin' && <span className="text-[10px] uppercase font-bold text-[#86868b] dark:text-[#98989d] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md">Admin</span>}
                              </span>
                              <span className="text-[13px] text-[#86868b] truncate">{member.username || 'last seen recently'}</span>
                            </div>
                          </div>
                          {isAdmin && String(member.id) !== String(currentUserId) && (
                            <button onClick={() => toggleAdmin(member.id, member.role)} className="px-3 py-1.5 rounded-full text-[12px] font-bold tracking-wide bg-[#1d1d1f]/5 dark:bg-[#f5f5f7]/10 text-[#1d1d1f] dark:text-[#f5f5f7]">
                              {member.role === 'admin' ? t.dismissAdmin : t.makeAdmin}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {(profileTab === 'media' || !isGroup || isChannel) && (
                    <div className="grid grid-cols-3 gap-1">
                      {chatMedia.length === 0 ? (
                        <div className="col-span-3 text-center py-10 text-[#86868b] font-medium">Нет медиа</div>
                      ) : (
                        chatMedia.map((url, i) => (
                          <div key={i} className="aspect-square bg-[#e5e5ea] dark:bg-[#333336] rounded-[4px] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openLightbox(url)}>
                            {url.match(/\.(mp4|webm)$/) ? <video src={url} className="w-full h-full object-cover pointer-events-none" /> : <img src={url} className="w-full h-full object-cover" loading="lazy" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ШАПКА ЧАТА */}
      <header className="px-3 pt-10 pb-2 border-b border-black/5 dark:border-white/5 flex flex-col bg-[#f5f5f7]/90 dark:bg-[#161618]/90 backdrop-blur-xl relative z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/"><a className="p-2 text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a></Link>
          <div className="flex items-center gap-3.5 cursor-pointer flex-1" onClick={() => !isSavedChat && setShowProfile(true)}>
            <div className="relative w-[44px] h-[44px] shrink-0">
              <div className={`w-full h-full rounded-full flex items-center justify-center font-medium text-[19px] overflow-hidden border border-black/5 dark:border-white/5 ${isSavedChat ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f]' : 'bg-[#e5e5ea] dark:bg-[#333336] text-[#1d1d1f] dark:text-[#f5f5f7]'}`}>
                {isSavedChat ? <Bookmark size={20} fill="currentColor" /> : chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? <img src={chatInfo?.participant?.avatarUrl} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
              </div>
              {!isSavedChat && !isGroupOrChannel && isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#1d1d1f] dark:bg-[#f5f5f7] border-2 border-[#f5f5f7] dark:border-[#161618] rounded-full z-10"></div>}
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] leading-tight truncate pr-2 tracking-tight">{displayName}</h2>
              {subtitleText && <p className={`text-[12px] font-medium mt-0.5 ${subtitleColor}`}>{subtitleText}</p>}
            </div>
          </div>
        </div>

        {/* ТОНКАЯ ЛИНИЯ ЗАКРЕПЛЕННЫХ СООБЩЕНИЙ */}
        {pinnedMessages.length > 0 && currentPinnedMsg && (
          <div
            className="mt-2 -mx-3 px-3 py-1 flex items-center gap-2 cursor-pointer border-t border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            onClick={() => {
              const el = document.getElementById(`msg-${currentPinnedMsg.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (pinnedMessages.length > 1) setActivePinnedIndex((prev) => (prev + 1) % pinnedMessages.length);
            }}
          >
            <div className="w-[2px] h-[26px] bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-full shrink-0"></div>
            <div className="flex flex-col flex-1 truncate py-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-none mb-0.5 uppercase tracking-wide">{t.pinnedMsg}</span>
                {pinnedMessages.length > 1 && <span className="text-[10px] text-[#86868b] dark:text-[#98989d] bg-black/5 dark:bg-white/10 px-1.5 rounded-full leading-tight mb-0.5">{activePinnedIndex + 1}/{pinnedMessages.length}</span>}
              </div>
              <span className="text-[12px] text-[#86868b] dark:text-[#98989d] truncate leading-none">{parseContent(currentPinnedMsg.content).text || t.photo}</span>
            </div>
            {isAdmin && <button onClick={(e) => { e.stopPropagation(); togglePin(currentPinnedMsg); }} className="p-1.5 text-[#86868b] active:scale-95 shrink-0"><X size={16} /></button>}
          </div>
        )}
      </header>

      {/* ОСНОВНАЯ ЛЕНТА СООБЩЕНИЙ / ПОСТОВ КАНАЛА */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-4 relative" onClick={() => setContextMenu(null)}>
        <div className="flex flex-col w-full max-w-full">
          {(() => {
            let lastDateStr = '';
            return messages.map((msg: any) => {
              const isMe = String(msg.senderId) === String(currentUserId);
              const { text, quotedText, mediaUrls, hasMedia, hasText, isVideo, voiceUrl, videoNoteUrl, fixedDuration } = parseContent(msg.content);
              const isOnlyVideoNote = videoNoteUrl && !hasText && !hasMedia && !voiceUrl;

              const dateObj = new Date(msg.createdAt);
              const currentDateStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
              const showDate = currentDateStr !== '' && currentDateStr !== lastDateStr;
              if (showDate) lastDateStr = currentDateStr;

              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const mReactionsKeys = msg.reactions ? Object.keys(msg.reactions) : [];
              const isMsgUploading = msg.id === uploadingMsgId;
              const isSwiping = swipeState.id === msg.id;
              const currentSwipeOffset = isSwiping ? swipeState.offset : 0;

              {/* РЕНДЕР ПОСТОВ В КАНАЛЕ */}
              if (isChannel) {
                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className="flex flex-col w-full mb-3 relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out cursor-pointer"
                    onClick={(e) => openGlobalMenu(e, msg, 'message')}
                    onContextMenu={(e) => { e.preventDefault(); openGlobalMenu(e, msg, 'message'); }}
                    onTouchStart={(e) => handleMsgSwipeStart(e, msg)}
                    onTouchMove={handleMsgSwipeMove}
                    onTouchEnd={handleMsgSwipeEnd}
                  >
                    {showDate && (
                      <div className="flex justify-center w-full my-3 relative z-0" onClick={(e) => e.stopPropagation()}>
                        <span className="bg-black/30 text-white backdrop-blur-md text-[11px] font-bold px-3 py-1 rounded-full capitalize">{currentDateStr}</span>
                      </div>
                    )}
                    <div
                      className="flex flex-col w-[86%] max-w-[340px] mr-auto items-start relative"
                      style={{
                        transform: `translate3d(${currentSwipeOffset}px, 0, 0)`,
                        transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.2, 1)'
                      }}
                    >
                      {currentSwipeOffset < -10 && (
                        <div
                          className="absolute -right-11 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/15 dark:bg-white/15 backdrop-blur-md flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]"
                          style={{ opacity: Math.min(1, Math.abs(currentSwipeOffset) / 50), transform: `translateY(-50%) scale(${Math.min(1.1, Math.abs(currentSwipeOffset) / 52)})` }}
                        >
                          <Reply size={16} />
                        </div>
                      )}
                      <div
                        className={isOnlyVideoNote ? 'relative flex flex-col cursor-pointer bg-transparent' : 'w-full bg-white dark:bg-[#222224] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-[22px] rounded-tl-[6px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 flex flex-col cursor-pointer overflow-hidden'}
                        onClick={(e) => openGlobalMenu(e, msg, 'message')}
                      >
                        {isMsgUploading ? (
                          <div className="px-4 py-3 flex items-center justify-center opacity-80">
                            <Loader2 size={20} className="animate-spin mr-2" /> <span className="text-[14px]">Загрузка...</span>
                          </div>
                        ) : (
                          <>
                            {videoNoteUrl && (
                              <div className={`${isOnlyVideoNote ? '' : 'p-2'} flex justify-center`}>
                                <div
                                  className={`relative inline-block w-[240px] h-[240px] rounded-full transition-transform duration-300 ease-out cursor-pointer ${expandedVideoMsgId === msg.id ? 'scale-[1.15] z-50 shadow-xl' : 'scale-100 z-10 shadow-sm'}`}
                                  onClick={(e) => { e.stopPropagation(); setExpandedVideoMsgId(expandedVideoMsgId === msg.id ? null : msg.id); }}
                                >
                                  <video src={videoNoteUrl} autoPlay loop muted playsInline className="w-full h-full rounded-full object-cover" />
                                  {expandedVideoMsgId !== msg.id && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-md">{timeStr}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {voiceUrl && (
                              <div className="pt-1">
                                <VoicePlayer url={voiceUrl} isMe={false} timeStr={timeStr} readStatus={false} isSaved={false} fixedDuration={fixedDuration} isSending={msg.isSending} />
                              </div>
                            )}

                            {hasMedia && (
                              <div className={`relative w-full overflow-hidden ${mediaUrls.length > 1 ? 'grid gap-[2px] bg-black/5 dark:bg-white/5' : 'flex justify-center bg-transparent'} ${mediaUrls.length >= 5 ? 'grid-cols-3' : mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {mediaUrls.map((url: string, idx: number) => {
                                  const isSingle = mediaUrls.length === 1;
                                  const itemClass = isSingle ? 'relative w-full flex justify-center' : `relative bg-[#e5e5ea] dark:bg-[#333336] ${mediaUrls.length === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}`;
                                  const imgClass = isSingle ? 'w-full h-auto max-h-[440px] object-cover block' : 'absolute inset-0 w-full h-full object-cover block';
                                  return (
                                    <div key={idx} className={itemClass}>
                                      {isVideo || url.match(/\.(mp4|webm|mov)$/i) || url.includes('/video/upload/') ? (
                                        <video src={url} controls className={imgClass} onClick={(e) => e.stopPropagation()} />
                                      ) : (
                                        <img
                                          src={url} loading="lazy" decoding="async" className={imgClass}
                                          style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                          onTouchStart={(e) => handleTouchStartPhoto(e, msg, 'message')}
                                          onMouseDown={(e) => handleTouchStartPhoto(e, msg, 'message')}
                                          onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                                          onClick={(e) => { e.stopPropagation(); clearPhotoTimer(); openLightbox(url); }}
                                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, msg, 'message'); }}
                                          onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {hasText && (
                              <div className="px-3.5 pt-2.5 pb-0.5">
                                {quotedText && (
                                  <div className="mb-1.5 pl-2.5 border-l-[2px] text-[12px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">{quotedText}</div>
                                )}
                                <div className="leading-[1.35] break-words whitespace-pre-wrap text-[#1d1d1f] dark:text-[#f5f5f7]" style={{ fontSize: `${textSize}px` }}>
                                  {text}
                                </div>
                              </div>
                            )}

                            {!isOnlyVideoNote && (
                              <div className="px-3.5 pt-2 pb-2.5 flex flex-wrap items-end gap-1.5">
                                {mReactionsKeys.map(key => {
                                  const rData = msg.reactions[key];
                                  const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                                  const isSelected = msg.myReaction === key;
                                  return (
                                    <button
                                      key={key}
                                      onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, key); }}
                                      className={`flex items-center justify-center gap-1.5 h-[28px] px-3 rounded-full transition-all active:scale-90 ${
                                        isSelected
                                          ? 'bg-[#1d1d1f] text-[#f5f5f7] dark:bg-[#f5f5f7] dark:text-[#1d1d1f] shadow-sm'
                                          : 'bg-black/[0.06] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.1] dark:hover:bg-white/[0.12]'
                                      }`}
                                    >
                                      <span className="text-[14px] leading-none flex items-center justify-center">{key}</span>
                                      <span className={`text-[12px] font-semibold leading-none flex items-center justify-center ${
                                        isSelected ? 'text-[#f5f5f7] dark:text-[#1d1d1f]' : 'text-[#1d1d1f]/80 dark:text-[#f5f5f7]/80'
                                      }`}>
                                        {count}
                                      </span>
                                    </button>
                                  );
                                })}
                                <span className="ml-auto text-[11px] font-medium text-[#86868b] dark:text-[#98989d] leading-none pt-1 select-none flex items-center gap-1">
                                  {msg.isEdited && <span className="italic mr-1">{t.edited}</span>}
                                  {timeStr}
                                  {msg.isSending && <Clock size={11} strokeWidth={2.5} className="animate-pulse ml-0.5" />}
                                </span>
                              </div>
                            )}

                            {!isOnlyVideoNote && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveThread(msg); loadComments(msg.chatId || chatId, msg.id); }}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                              >
                                <div className="flex gap-2 items-center">
                                  <MessageCircle size={15} className="text-[#86868b] dark:text-[#98989d]" />
                                  <span className="text-[12px] font-medium text-[#86868b] dark:text-[#98989d]">
                                    {(msg.commentsCount || 0) > 0 ? `${msg.commentsCount} ${declOfNum(msg.commentsCount || 0, t.commentsCount, lang)}` : t.comments}
                                  </span>
                                </div>
                                <ChevronRight size={15} className="text-[#86868b] dark:text-[#98989d]" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              {/* РЕНДЕР СООБЩЕНИЙ В ЛИЧНЫХ ЧАТАХ И ГРУППАХ */}
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="flex flex-col w-full mb-1.5 relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out cursor-pointer"
                  onClick={(e) => openGlobalMenu(e, msg, 'message')}
                  onContextMenu={(e) => { e.preventDefault(); openGlobalMenu(e, msg, 'message'); }}
                  onTouchStart={(e) => handleMsgSwipeStart(e, msg)}
                  onTouchMove={handleMsgSwipeMove}
                  onTouchEnd={handleMsgSwipeEnd}
                >
                  {showDate && (
                    <div className="flex justify-center w-full my-4 relative z-0" onClick={(e) => e.stopPropagation()}>
                      <span className="bg-black/30 text-white backdrop-blur-md text-[11px] font-bold px-3 py-1 rounded-full capitalize">{currentDateStr}</span>
                    </div>
                  )}

                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[420px] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} relative`}
                    style={{
                      transform: `translate3d(${currentSwipeOffset}px, 0, 0)`,
                      transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.2, 1)'
                    }}
                  >
                    {currentSwipeOffset < -10 && (
                      <div
                        className="absolute -right-10 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/15 dark:bg-white/15 backdrop-blur-md flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]"
                        style={{ opacity: Math.min(1, Math.abs(currentSwipeOffset) / 50), transform: `translateY(-50%) scale(${Math.min(1.1, Math.abs(currentSwipeOffset) / 52)})` }}
                      >
                        <Reply size={16} />
                      </div>
                    )}

                    {isGroup && !isMe && msg.senderName && !isOnlyVideoNote && (
                      <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] ml-2 mb-1">{msg.senderName}</span>
                    )}

                    <div
                      className={isOnlyVideoNote
                        ? 'relative flex flex-col cursor-pointer bg-transparent'
                        : `shadow-sm relative flex flex-col min-w-[60px] ${hasMedia ? 'w-[75vw] max-w-[320px]' : 'w-fit max-w-full'} cursor-pointer overflow-hidden ${isMe ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] rounded-[18px] rounded-tr-[4px]' : 'bg-white dark:bg-[#222224] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-[18px] rounded-tl-[4px] border border-black/5 dark:border-white/5'}`
                      }
                      onClick={(e) => openGlobalMenu(e, msg, 'message')}
                    >
                      {isMsgUploading ? (
                        <div className={`px-4 py-3 flex items-center justify-center opacity-80 ${isOnlyVideoNote ? 'bg-black/10 rounded-full w-[220px] h-[220px]' : ''}`}>
                          <Loader2 size={20} className="animate-spin mr-2" /> <span className="text-[14px]">Загрузка...</span>
                        </div>
                      ) : (
                        <>
                          {videoNoteUrl && (
                            <div className={`${isOnlyVideoNote ? '' : 'p-1.5'} flex justify-center`}>
                              <div
                                className={`relative inline-block w-[240px] h-[240px] rounded-full transition-transform duration-300 ease-out cursor-pointer ${expandedVideoMsgId === msg.id ? 'scale-[1.15] z-50 shadow-xl' : 'scale-100 z-10 shadow-sm'}`}
                                onClick={(e) => { e.stopPropagation(); setExpandedVideoMsgId(expandedVideoMsgId === msg.id ? null : msg.id); }}
                              >
                                <video src={videoNoteUrl} autoPlay loop muted playsInline className="w-full h-full rounded-full object-cover" />
                                {expandedVideoMsgId !== msg.id && (
                                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 backdrop-blur-md">
                                    {timeStr}
                                    {isMe && (msg.isSending ? <Clock size={10} strokeWidth={3} className="animate-pulse ml-0.5" /> : <div className="flex -space-x-1 ml-0.5"><Check size={10} strokeWidth={3} />{isMsgRead(msg, isSavedChat) ? <Check size={10} strokeWidth={3} /> : null}</div>)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {voiceUrl && (
                            <div className={`${hasText ? 'pb-1' : ''}`}>
                              <VoicePlayer url={voiceUrl} isMe={isMe} timeStr={timeStr} readStatus={isMsgRead(msg, isSavedChat)} isSaved={isSavedChat} fixedDuration={fixedDuration} isSending={msg.isSending} />
                            </div>
                          )}

                          {hasMedia && (
                            <div className={`relative w-full overflow-hidden ${mediaUrls.length > 1 ? 'grid gap-[2px] bg-black/5 dark:bg-white/5' : 'flex justify-center bg-transparent'} ${mediaUrls.length >= 5 ? 'grid-cols-3' : mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {mediaUrls.map((url: string, idx: number) => {
                                const isSingle = mediaUrls.length === 1;
                                const itemClass = isSingle ? 'relative w-full flex justify-center' : `relative bg-[#e5e5ea] dark:bg-[#333336] ${mediaUrls.length === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}`;
                                const imgClass = isSingle ? 'w-full h-auto max-h-[440px] object-cover block' : 'absolute inset-0 w-full h-full object-cover block';
                                return (
                                  <div key={idx} className={itemClass}>
                                    {isVideo || url.match(/\.(mp4|webm|mov)$/i) || url.includes('/video/upload/') ? (
                                      <video src={url} controls className={imgClass} onClick={(e) => e.stopPropagation()} />
                                    ) : (
                                      <img
                                        src={url} loading="lazy" decoding="async" className={imgClass}
                                        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                        onTouchStart={(e) => handleTouchStartPhoto(e, msg, 'message')}
                                        onMouseDown={(e) => handleTouchStartPhoto(e, msg, 'message')}
                                        onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                                        onClick={(e) => { e.stopPropagation(); clearPhotoTimer(); openLightbox(url); }}
                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, msg, 'message'); }}
                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }}
                                      />
                                    )}
                                  </div>
                                );
                              })}

                              {(!hasText && !voiceUrl && !videoNoteUrl) && (
                                <div className="absolute bottom-1.5 right-1.5 bg-black/40 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 backdrop-blur-md pointer-events-none">
                                  {timeStr}
                                  {isMe && (msg.isSending ? <Clock size={11} strokeWidth={2.5} className="animate-pulse ml-0.5" /> : <div className="flex -space-x-1 ml-0.5"><Check size={11} strokeWidth={2.5} />{isMsgRead(msg, isSavedChat) ? <Check size={11} strokeWidth={2.5} /> : null}</div>)}
                                </div>
                              )}
                            </div>
                          )}

                          {hasText && (
                            <div className="px-3 pt-2 pb-2.5">
                              {quotedText && (
                                <div className={`mb-1.5 pl-2.5 border-l-[3px] font-medium opacity-80 truncate ${isMe ? 'border-white/40 dark:border-black/40' : 'border-black/10 dark:border-white/10'}`} style={{ fontSize: `${Math.max(11, textSize - 3)}px` }}>{quotedText}</div>
                              )}
                              <div className="leading-[1.35] break-words whitespace-pre-wrap" style={{ fontSize: `${textSize}px` }}>
                                {text}
                                {(!voiceUrl && !videoNoteUrl) && (
                                  <span className={`float-right inline-flex items-center gap-1 text-[10px] ml-3 mt-1.5 pointer-events-none select-none relative top-[2px] ${isMe ? 'opacity-60 text-current' : 'text-[#86868b] dark:text-[#98989d]'}`}>
                                    {msg.isEdited && <span className="italic mr-0.5">{t.edited}</span>}
                                    {timeStr}
                                    {isMe && (msg.isSending ? <Clock size={11} strokeWidth={2.5} className="animate-pulse ml-0.5" /> : <div className="flex -space-x-1 ml-0.5"><Check size={12} strokeWidth={2.5} />{isMsgRead(msg, isSavedChat) ? <Check size={12} strokeWidth={2.5} /> : null}</div>)}
                                  </span>
                                )}
                                <div className="clear-both"></div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {mReactionsKeys.length > 0 && !isOnlyVideoNote && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {mReactionsKeys.map(key => {
                          const rData = msg.reactions[key];
                          const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                          const isSelected = msg.myReaction === key;
                          return (
                            <button
                              key={key}
                              onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, key); }}
                              className={`flex items-center justify-center gap-1.5 h-[26px] px-2.5 rounded-full transition-all active:scale-90 ${
                                isSelected
                                  ? 'bg-[#1d1d1f] text-[#f5f5f7] dark:bg-[#f5f5f7] dark:text-[#1d1d1f] shadow-sm'
                                  : 'bg-white dark:bg-[#222224] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5 shadow-sm'
                              }`}
                            >
                              <span className="text-[13px] leading-none flex items-center justify-center">{key}</span>
                              <span className={`text-[11px] font-semibold leading-none flex items-center justify-center ${
                                isSelected ? 'text-[#f5f5f7] dark:text-[#1d1d1f]' : 'text-[#86868b] dark:text-[#98989d]'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </main>

      {/* МОДАЛКА КОММЕНТАРИЕВ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out" onClick={() => setContextMenu(null)}>
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.comments}</h1>
            </div>
          </header>

          <div ref={commentsScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-10">
            <div className="bg-white dark:bg-[#222224] p-4 rounded-[20px] mb-2 border border-black/5 dark:border-white/5 flex flex-col">
              <span className="font-semibold text-[14px] text-[#86868b] dark:text-[#98989d] mb-1 block">{activeThread.channelName || displayName}</span>
              {activeThreadContent?.hasMedia && (
                <div className="flex gap-2 overflow-x-auto my-2">
                  {activeThreadContent.mediaUrls.map((url: string) => (
                    <img key={url} src={url} onClick={(e) => { e.stopPropagation(); openLightbox(url); }} className="h-[80px] w-auto rounded-[8px] object-cover border border-black/5 dark:border-white/5 cursor-pointer" />
                  ))}
                </div>
              )}
              {activeThreadContent?.hasText && (
                <p className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap">{activeThreadContent.text}</p>
              )}
            </div>

            {threadComments.length === 0 ? (
              <div className="text-center text-[#86868b] dark:text-[#98989d] mt-10 font-medium">{t.noComments}</div>
            ) : (
              threadComments.map((c) => {
                const { text, quotedText, hasMedia, mediaUrls, hasText } = parseContent(c.content);
                const cReactionsKeys = c.reactions ? Object.keys(c.reactions) : [];

                return (
                  <div key={c.id} className="relative flex flex-col mb-2 z-10" onClick={(e) => openGlobalMenu(e, c, 'comment')}>
                    <div className="flex gap-3 items-start cursor-pointer" onClick={(e) => openGlobalMenu(e, c, 'comment')} onContextMenu={(e) => { e.preventDefault(); openGlobalMenu(e, c, 'comment'); }}>
                      <div className="w-9 h-9 rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center shrink-0 overflow-hidden text-[13px] font-medium border border-black/5 dark:border-white/5 text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {c.senderAvatar ? <img src={c.senderAvatar} className="w-full h-full object-cover" /> : c.senderName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col flex-1 bg-white dark:bg-[#222224] p-3 rounded-[18px] rounded-tl-[4px] border border-black/5 dark:border-white/5">
                        <span className="text-[13px] font-semibold mb-1 text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{c.senderName}</span>
                        {quotedText && <div className="mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">{quotedText}</div>}
                        {hasMedia && (
                          <img
                            src={mediaUrls[0]}
                            className={`max-h-[200px] w-auto object-cover cursor-pointer ${hasText ? 'rounded-t-[8px] mb-1' : 'rounded-[8px]'}`}
                            style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                            onTouchStart={(e) => handleTouchStartPhoto(e, c, 'comment')}
                            onMouseDown={(e) => handleTouchStartPhoto(e, c, 'comment')}
                            onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                            onClick={(e) => { e.stopPropagation(); clearPhotoTimer(); openLightbox(mediaUrls[0]); }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, c, 'comment'); }}
                          />
                        )}
                        {hasText && <span className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap leading-snug">{text}</span>}
                        <span className="text-[11px] text-[#86868b] dark:text-[#98989d] mt-1.5 text-right">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {cReactionsKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 justify-start pl-12">
                        {cReactionsKeys.map(key => {
                          const rData = c.reactions[key];
                          const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                          const isSelected = c.myReaction === key;
                          return (
                            <button
                              key={key}
                              onClick={(e) => { e.stopPropagation(); toggleReaction(c.id, key, true); }}
                              className={`flex items-center justify-center gap-1 h-[24px] px-2.5 rounded-full border transition-transform active:scale-95 ${
                                isSelected ? 'bg-[#1d1d1f] text-[#f5f5f7] dark:bg-[#f5f5f7] dark:text-[#1d1d1f] border-transparent' : 'bg-white dark:bg-[#222224] border-black/5 dark:border-white/5 text-[#1d1d1f] dark:text-[#f5f5f7]'
                              }`}
                            >
                              <span className="text-[13px] leading-none flex items-center justify-center">{key}</span>
                              <span className="text-[11px] font-semibold leading-none flex items-center justify-center">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-white/80 dark:bg-[#222224]/80 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col backdrop-blur-xl">
            {commentReplyingTo && (
              <div className="flex items-center justify-between mb-1 mt-3 mx-4 px-4 py-2.5 bg-[#f5f5f7] dark:bg-[#161618] rounded-[14px] border-l-[3px] border-[#1d1d1f] dark:border-[#f5f5f7]">
                <div className="flex flex-col mr-4">
                  <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase">{t.replyAction}</span>
                  <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate">{parseContent(commentReplyingTo.content).text || t.photo}</span>
                </div>
                <button type="button" onClick={() => setCommentReplyingTo(null)} className="p-1.5 flex-shrink-0 text-[#86868b]"><X size={16} /></button>
              </div>
            )}
            <form onSubmit={handleSendComment} className="p-3 flex items-center gap-2 pb-6">
              <input type="file" accept="image/*,video/*" className="hidden" ref={commentFileInputRef} onChange={handleCommentFileUpload} />
              <button type="button" onClick={() => commentFileInputRef.current?.click()} disabled={isCommentUploading} className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#86868b] disabled:opacity-50">
                {isCommentUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}
              </button>
              <input className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-full px-5 py-2.5 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-[15px]" value={commentContent} onChange={e => setCommentContent(e.target.value)} placeholder={t.commentPlaceholder} />
              <button type="submit" disabled={!commentContent.trim()} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95">
                <ChevronRight size={20} strokeWidth={2.5} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ПАНЕЛЬ ОТПРАВКИ СООБЩЕНИЯ */}
      {!activeThread && (
        <div className="bg-white/90 dark:bg-[#161618]/90 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col backdrop-blur-xl">
          {(replyingTo || editingMsg) && (
            <div className="flex items-center justify-between mb-1 mt-3 mx-4 px-4 py-2.5 bg-[#f5f5f7] dark:bg-[#222224] rounded-[14px] border-l-[3px] border-[#1d1d1f] dark:border-[#f5f5f7]">
              <div className="flex flex-col mr-4">
                <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase">{editingMsg ? t.editing : t.replyAction}</span>
                <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate">{editingMsg ? (parseContent(editingMsg.content).text || t.photo) : (parseContent(replyingTo.content).text || t.photo)}</span>
              </div>
              <button type="button" onClick={() => { setReplyingTo(null); setEditingMsg(null); setContent(''); }} className="p-1.5 flex-shrink-0 text-[#86868b]"><X size={16} /></button>
            </div>
          )}

          {(!isGroupOrChannel || isMember) && !(isChannel && !isAdmin) ? (
            recordingType ? (
              <div className="p-3 flex items-center justify-between pb-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => stopRecording(true)} className="text-[#1d1d1f] dark:text-[#f5f5f7] p-2 active:scale-95 transition-transform"><Trash2 size={24} /></button>
                  {recordingType === 'video' && <button onClick={toggleCamera} className="text-[#1d1d1f] dark:text-[#f5f5f7] p-2 active:scale-95 transition-transform"><RefreshCw size={22} /></button>}
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-full animate-pulse" />
                    <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px] font-semibold tracking-wide">{formatMsTime(recordingMs)}</span>
                  </div>
                </div>
                <button onClick={() => stopRecording(false)} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f] flex items-center justify-center active:scale-95 transition-transform"><ArrowUp size={20} strokeWidth={2.5} /></button>
              </div>
            ) : (
              <form onSubmit={handleSend} className="p-3 flex items-center gap-2 pb-6">
                <input type="file" accept="image/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#86868b] disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">{isUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}</button>
                <input ref={inputRef} className="flex-1 bg-[#f5f5f7] dark:bg-[#222224] border border-black/5 dark:border-white/5 rounded-[20px] px-4 py-2 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px]" value={content} onChange={(e) => { setContent(e.target.value); if (Date.now() - lastTypingTime.current > 2000) { lastTypingTime.current = Date.now(); socket?.emit('typing', { chatId, name: currentUser?.displayName }); } }} placeholder={t.messagePlaceholder} />
                {!content.trim() ? (
                  <button
                    type="button"
                    onMouseDown={handleRecordTouchStart} onMouseUp={handleRecordTouchEnd}
                    onTouchStart={handleRecordTouchStart} onTouchEnd={handleRecordTouchEnd} onMouseLeave={handleRecordTouchEnd}
                    className="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center text-[#86868b] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none relative"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  >
                    <div className={`transition-transform duration-150 absolute inset-0 flex items-center justify-center ${isAnimatingIcon ? 'scale-0' : 'scale-100'}`}>
                      {recordMode === 'voice' ? <Mic size={24} strokeWidth={1.5} /> : <Camera size={24} strokeWidth={1.5} />}
                    </div>
                  </button>
                ) : (
                  <button type="submit" disabled={isUploading} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95"><ArrowUp size={20} strokeWidth={2.5} /></button>
                )}
              </form>
            )
          ) : isLoadingRole ? (
            <div className="flex items-center gap-2 px-3 py-3 pb-6 opacity-50"><div className="w-[38px] h-[38px] rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div><div className="flex-1 h-[38px] rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div><div className="w-[38px] h-[38px] rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div></div>
          ) : !isMember ? (
            <div className="flex items-center justify-center pt-2 pb-6 px-4"><button onClick={joinChat} className="w-full py-3 bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] font-semibold rounded-[16px] text-[15px]">{isChannel ? t.subscribe : t.joinGroup}</button></div>
          ) : (
            <div className="flex items-center justify-center pt-2 pb-6"><button onClick={() => setIsMuted(!isMuted)} className="text-[#86868b] text-[15px] font-medium">{isMuted ? t.unmute : t.mute}</button></div>
          )}
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ */}
      {contextMenu && (() => {
        const menuWidth = 220; const menuHeight = 280;
        let safeX = contextMenu.x; let safeY = contextMenu.y;
        if (safeX + menuWidth > window.innerWidth) safeX = window.innerWidth - menuWidth - 10;
        if (safeY + menuHeight > window.innerHeight) safeY = safeY - menuHeight;
        if (safeY < 0) safeY = 20;

        const isMe = String(contextMenu.item.senderId) === String(currentUserId);
        const { hasText } = parseContent(contextMenu.item.content);
        const showReply = contextMenu.type === 'comment' || !isChannel;
        const showCopy = hasText;
        const showForward = contextMenu.type === 'message';
        const showPin = contextMenu.type === 'message' && (isAdmin || !isGroupOrChannel);
        const showEdit = isMe && contextMenu.type === 'message';
        const showDelete = isMe || isAdmin;
        const isPinned = pinnedMessages.some(m => m.id === contextMenu.item.id);

        return (
          <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
            <div className="absolute flex flex-col gap-2 animate-in zoom-in-[0.95] fade-in duration-200" style={{ top: safeY, left: safeX }} onClick={e => e.stopPropagation()}>
              <div className="flex gap-1.5 p-2 bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-full shadow-lg border border-black/5 dark:border-white/5">
                {FAST_REACTIONS.map(emoji => (
                  <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(contextMenu.id, emoji, contextMenu.type === 'comment'); }} className="w-8 h-8 flex items-center justify-center text-[20px] rounded-full hover:scale-125 transition-transform active:scale-95">{emoji}</button>
                ))}
              </div>
              <div className="flex flex-col bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-[20px] shadow-lg border border-black/5 dark:border-white/5 overflow-hidden w-full">
                {showReply && <button onClick={(e) => { e.stopPropagation(); if (contextMenu.type === 'comment') setCommentReplyingTo(contextMenu.item); else setReplyingTo(contextMenu.item); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Reply size={18} className="text-[#86868b]" /> {t.replyAction}</button>}
                {showCopy && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(parseContent(contextMenu.item.content).text); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Copy size={18} className="text-[#86868b]" /> {t.copy}</button>}
                {showPin && <button onClick={(e) => { e.stopPropagation(); togglePin(contextMenu.item); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Pin size={18} className="text-[#86868b]" /> {isPinned ? t.unpin : t.pin}</button>}
                {showForward && <button onClick={(e) => { e.stopPropagation(); openForwardModal(contextMenu.item); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Forward size={18} className="text-[#86868b]" /> {t.forward}</button>}
                {showEdit && <button onClick={(e) => { e.stopPropagation(); setContextMenu(null); startEditing(contextMenu.item); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Edit2 size={18} className="text-[#86868b]" /> {t.editAction}</button>}
                {showDelete && <button onClick={(e) => { e.stopPropagation(); if (contextMenu.type === 'comment') deleteMessage(contextMenu.id, true); else deleteMessage(contextMenu.id); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/5"><Trash2 size={18} className="text-[#86868b]" /> {t.deleteAction}</button>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
