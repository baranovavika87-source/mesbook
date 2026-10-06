import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Trash2, Edit2, Loader2, Check, X, Paperclip, Bookmark, Calendar, Volume2, Edit3, Camera, ChevronRight, Download, Smile, MessageCircle, Send, Copy, Reply, Mic, Video, Square, Play, RefreshCw, SendHorizonal, ArrowUp } from 'lucide-react';
import { io } from 'socket.io-client';

let socket: any = null;

const getUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}'); return u.id || u.userId || u._id || 1; } catch (e) { return 1; }
};

const FAST_REACTIONS = ['❤️', '👍', '🔥', '😂', '😢'];

const translations = {
  ru: {
    saved: "Избранное",
    companion: "Собеседник",
    attachment: "Вложение",
    photo: "Фотография",
    info: "Информация",
    name: "Название",
    desc: "Описание",
    bio: "О себе",
    channel: "Канал",
    personalChannel: "Личный Канал",
    birthday: "День рождения",
    online: "В сети",
    lastSeenAt: "Был(а)",
    recently: "недавно",
    group: "Группа",
    subs: ['подписчик', 'подписчика', 'подписчиков'],
    members: ['участник', 'участника', 'участников'],
    onlineCount: "в сети",
    subscribe: "Подписаться",
    joinGroup: "Вступить в группу",
    mute: "Убрать звук",
    unmute: "Включить звук",
    reply: "Ответ",
    editing: "Редактирование",
    edited: "изменено",
    messagePlaceholder: "Сообщение",
    commentPlaceholder: "Комментарий...",
    deleteConfirm: "Удалить сообщение?",
    comments: "Комментарии",
    noComments: "Пока нет комментариев",
    commentsCount: ['комментарий', 'комментария', 'комментариев'],
    isTyping: "печатает...",
    areTyping: "печатают...",
    replyAction: "Ответить",
    copy: "Копировать",
    editAction: "Изменить",
    deleteAction: "Удалить",
    cancel: "ОТМЕНА"
  },
  en: {
    saved: "Saved Messages",
    companion: "Companion",
    attachment: "Attachment",
    photo: "Photo",
    info: "Info",
    name: "Name",
    desc: "Description",
    bio: "Bio",
    channel: "Channel",
    personalChannel: "Personal Channel",
    birthday: "Birthday",
    online: "Online",
    lastSeenAt: "Last seen",
    recently: "recently",
    group: "Group",
    subs: ['subscriber', 'subscribers'],
    members: ['member', 'members'],
    onlineCount: "online",
    subscribe: "Subscribe",
    joinGroup: "Join Group",
    mute: "Mute",
    unmute: "Unmute",
    reply: "Reply",
    editing: "Edit Message",
    edited: "edited",
    messagePlaceholder: "Message",
    commentPlaceholder: "Comment...",
    deleteConfirm: "Delete message?",
    comments: "Comments",
    noComments: "No comments yet",
    commentsCount: ['comment', 'comments', 'comments'],
    isTyping: "is typing...",
    areTyping: "are typing...",
    replyAction: "Reply",
    copy: "Copy",
    editAction: "Edit",
    deleteAction: "Delete",
    cancel: "CANCEL"
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
  if (!timestamp) return lang === 'ru' ? 'недавно' : 'recently';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return lang === 'ru' ? `сегодня в ${timeStr}` : `today at ${timeStr}`;
  if (isYesterday) return lang === 'ru' ? `вчера в ${timeStr}` : `yesterday at ${timeStr}`;
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  let dateStr = date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', options);
  if (lang === 'ru') dateStr = dateStr.replace('.', '');
  return lang === 'ru' ? `${dateStr} в ${timeStr}` : `${dateStr} at ${timeStr}`;
};

const isMsgRead = (msg: any, isSavedChat: boolean) => {
  if (isSavedChat) return true; // ИСПРАВЛЕНИЕ 3: В избранном всегда 2 галочки
  if (!msg) return false;
  return msg.read === true || msg.read === 1 || msg.read === '1' || 
         msg.isRead === true || msg.isRead === 1 || msg.isRead === '1' || 
         msg.status === 'read' || msg.viewed === true;
};

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s},0`; // Формат как в ТГ 00:00,0
};

// КАСТОМНЫЙ ПЛЕЕР ГОЛОСОВЫХ СООБЩЕНИЙ (С ТОНКИМИ ПОЛОСКАМИ)
const VoicePlayer = ({ url, isMe, timeStr, readStatus, isSaved }: any) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => {
       setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    const onLoadedMetadata = () => setDuration(audio.duration);
    
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  const togglePlay = (e: any) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const formatAudioTime = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Более частые и тонкие полоски как в ТГ
  const bars = [2, 4, 3, 5, 7, 8, 6, 4, 5, 3, 2, 4, 6, 5, 7, 8, 6, 4, 2, 3, 5, 4, 2];

  return (
    <div className="flex items-center gap-3 px-3 py-2 w-[260px]">
      <button onClick={togglePlay} className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isMe ? 'bg-white dark:bg-[#161618] text-[#1d1d1f] dark:text-[#f5f5f7]' : 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f]'}`}>
         {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      <div className="flex-1 flex flex-col justify-center">
         <div className="flex items-end gap-[2px] h-6 w-full opacity-80 mt-1">
            {bars.map((h, i) => (
               <div key={i} className={`w-[2.5px] rounded-full ${isMe ? 'bg-white/90 dark:bg-black/90' : 'bg-black/80 dark:bg-white/80'}`} style={{ height: `${(h/8)*100}%`, opacity: progress > (i/bars.length)*100 ? 1 : 0.4 }}></div>
            ))}
         </div>
         <div className="flex justify-between items-center text-[11px] mt-1.5 opacity-70 font-medium">
            <span>{formatAudioTime(isPlaying ? audioRef.current?.currentTime || 0 : duration)}</span>
            <div className="flex items-center gap-1">
               <span>{timeStr}</span>
               {isMe && <div className="flex -space-x-1"><Check size={11} strokeWidth={2.5} />{(readStatus || isSaved) && <Check size={11} strokeWidth={2.5} />}</div>}
            </div>
         </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
};

export default function ChatPage() {
  const [match, params] = useRoute('/chat/:chatId');
  const chatId = params?.chatId;
  const numericChatId = Number(chatId);
  const isGroupOrChannel = numericChatId >= 100000000;
  const isSavedChat = chatId === 'saved';
  const currentUserId = getUserId();
  
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mesbook_user') || '{}'); } catch(e) { return {}; } })();

  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [messages, setMessages] = useState<any[]>(() => {
    try {
      if (isSavedChat) return JSON.parse(localStorage.getItem('mesbook_saved_messages_' + currentUserId) || '[]').map((m: any) => ({...m, isSending: false}));
      const cached = localStorage.getItem('mesbook_messages_cache_' + currentUserId + '_' + chatId);
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });

  const [content, setContent] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{ id: number, x: number, y: number, type: 'message' | 'comment', item: any } | null>(null);
  
  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [isCommentUploading, setIsCommentUploading] = useState(false);
  const [commentReplyingTo, setCommentReplyingTo] = useState<any>(null);
  
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isMember, setIsMember] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingTime = useRef(0);

  const [isEditingChat, setIsEditingChat] = useState(false);
  const [editChatName, setEditChatName] = useState('');
  const [editChatDesc, setEditChatDesc] = useState('');
  const [editChatAvatar, setEditChatAvatar] = useState('');
  const [isSavingChat, setIsSavingChat] = useState(false);
  
  // МЕДИА РЕКОРДЕР И КНОПКА
  const [recordMode, setRecordMode] = useState<'voice' | 'video'>('voice');
  const [isAnimatingIcon, setIsAnimatingIcon] = useState(false);
  const [recordingType, setRecordingType] = useState<'voice' | 'video' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  
  const [expandedVideoMsgId, setExpandedVideoMsgId] = useState<number | null>(null); // Для увеличения кружочка
  const [uploadingMsgId, setUploadingMsgId] = useState<number | null>(null); // Для спиннера загрузки

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoStreamRef = useRef<HTMLVideoElement>(null);

  const editAvatarRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  
  const photoOpenedRef = useRef(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const [chatInfo, setChatInfo] = useState<any>(() => {
    if (isSavedChat) return { participant: { displayName: t.saved, isSaved: true } };
    try {
      const savedChats = JSON.parse(localStorage.getItem('mesbook_chats_' + currentUserId) || '[]');
      return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
    } catch(e) { return null; }
  });

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = isSavedChat ? t.saved : (chatInfo?.participant?.displayName || chatInfo?.name || savedName || t.companion);
  
  const isChannel = chatInfo?.participant?.isChannel;
  const isGroup = chatInfo?.participant?.isGroup && !isChannel;

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
        let idToCheck = null;
        if (typeof data === 'object' && data !== null) {
          idToCheck = data.chatId || data.id;
        } else {
          idToCheck = data;
        }
        if (!idToCheck || String(idToCheck) === String(chatId) || Number(idToCheck) === Number(chatId)) {
          loadData(); 
        }
      };
      
      const handleTyping = (data: any) => {
        if (Number(data.chatId) === Number(chatId) && data.name !== chatInfo?.participant?.displayName) {
          setTypingUsers(prev => prev.includes(data.name) ? prev : [...prev, data.name]);
          setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== data.name)), 3000);
        }
      };

      socket.on('chat_update', handleUpdate);
      socket.on('message_read', handleUpdate);
      socket.on('messages_read', handleUpdate);
      socket.on('message', handleUpdate);
      socket.on('typing', handleTyping);
      
      return () => { 
        socket.off('chat_update', handleUpdate); 
        socket.off('message_read', handleUpdate);
        socket.off('messages_read', handleUpdate);
        socket.off('message', handleUpdate);
        socket.off('typing', handleTyping); 
      };
    }
  }, [chatId]);

  useEffect(() => {
    if (!isSavedChat && messages.length > 0) {
      const confirmedMsgs = messages.filter(m => !m.isSending);
      localStorage.setItem('mesbook_messages_cache_' + currentUserId + '_' + chatId, JSON.stringify(confirmedMsgs));
    }
  }, [messages, chatId, currentUserId, isSavedChat]);

  const loadComments = async (targetChatId: number, messageId: number) => {
    try {
      const commRes = await fetch(`/api/chats/${targetChatId}/messages/${messageId}/comments`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (commRes.ok) setThreadComments(await commRes.json());
    } catch(e) {}
  };

  const loadData = async () => {
    if (isSavedChat) {
      try {
        const saved = JSON.parse(localStorage.getItem('mesbook_saved_messages_' + currentUserId) || '[]');
        setMessages(saved.map((m: any) => ({...m, isSending: false})));
      } catch(e) {}
      setIsLoadingRole(false); return;
    }
    
    if (isGroupOrChannel) {
      try {
        const roleRes = await fetch(`/api/chats/${chatId}/is_member`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (roleRes.ok) {
           const roleData = await roleRes.json();
           setIsMember(roleData.isMember); setIsAdmin(roleData.role === 'admin');
           setMembersCount(roleData.membersCount || 1); setOnlineCount(roleData.onlineCount || 1);
        }
      } catch (e) {}
    }
    setIsLoadingRole(false);
    
    try { await fetch('/api/chats/' + chatId + '/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {}
    
    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      }
    } catch (e) {}
    
    if (activeThread) {
       loadComments(activeThread.chatId || chatId, activeThread.id);
    }
  };

  useEffect(() => { loadData(); }, [chatId, activeThread]);

  const forceScrollToBottom = () => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 10); };
  useEffect(() => { forceScrollToBottom(); }, [messages]);

  useEffect(() => {
    if (commentsScrollRef.current && threadComments.length > 0) {
      commentsScrollRef.current.scrollTop = commentsScrollRef.current.scrollHeight;
    }
  }, [threadComments]);

  // ФУНКЦИИ ЗАПИСИ И ОТПРАВКИ
  const initCamera = async (mode: 'user' | 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: mode } });
      if (videoStreamRef.current) videoStreamRef.current.srcObject = stream;
      return stream;
    } catch(e) { return null; }
  };

  const startRecording = async (type: 'voice' | 'video', mode: 'user' | 'environment' = 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' ? { facingMode: mode } : false });
      if (type === 'video' && videoStreamRef.current) {
         videoStreamRef.current.srcObject = stream;
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        
        // Показываем спиннер загрузки
        const tempId = Date.now();
        setUploadingMsgId(tempId);
        
        const tempMsg = { id: tempId, content: type === 'video' ? '[VIDEO_NOTE] loading' : '[VOICE] loading', isSending: true, senderId: currentUserId, createdAt: new Date().toISOString(), read: false };
        setMessages((prev: any) => [...prev, tempMsg]);
        forceScrollToBottom();

        const formData = new FormData();
        formData.append('file', blob, type === 'video' ? 'video.webm' : 'voice.webm');
        formData.append('upload_preset', 'mesogram-cloud');
        formData.append('resource_type', 'auto'); 
        
        try {
          const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.secure_url) {
             const tag = type === 'video' ? '[VIDEO_NOTE]' : '[VOICE]';
             // Удаляем временное сообщение и шлем настоящее
             setMessages((prev: any) => prev.filter((m:any) => m.id !== tempId));
             sendDirectMessage(`${tag} ${data.secure_url}`);
          }
        } catch(e) {
           setMessages((prev: any) => prev.filter((m:any) => m.id !== tempId));
        }
        setUploadingMsgId(null);
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingType(type);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch(e) { 
      alert('Необходим доступ к микрофону и/или камере'); 
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
         mediaRecorderRef.current.onstop = () => {
           mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
         };
      }
      mediaRecorderRef.current.stop();
    }
    setRecordingType(null);
  };

  const toggleCamera = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
       const newMode = cameraFacingMode === 'user' ? 'environment' : 'user';
       setCameraFacingMode(newMode);
       mediaRecorderRef.current.stop(); // Останавливаем старую
       setTimeout(() => startRecording('video', newMode), 100); // Запускаем с новой камерой
    }
  };

  // ЛОГИКА ТАПА И УДЕРЖАНИЯ КНОПКИ МИКРОФОНА/КАМЕРЫ
  const handleRecordTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    holdTimerRef.current = setTimeout(() => {
       startRecording(recordMode, cameraFacingMode);
       holdTimerRef.current = null;
    }, 300);
  };

  const handleRecordTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        // Быстрый тап - переключаем режим с анимацией
        setIsAnimatingIcon(true);
        setTimeout(() => {
            setRecordMode(p => p === 'voice' ? 'video' : 'voice');
            setIsAnimatingIcon(false);
        }, 150);
    }
  };

  const sendDirectMessage = async (msgContent: string) => {
    const tempMsg = { id: Date.now(), content: msgContent, isSending: true, senderId: currentUserId, createdAt: new Date().toISOString(), read: false };
    if (isSavedChat) {
      setMessages((prev: any) => { const u = [...prev, { ...tempMsg, isSending: false }]; localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(u)); return u; });
      forceScrollToBottom(); return;
    }
    setMessages((prev: any) => [...prev, tempMsg]);
    forceScrollToBottom();
    try {
      await fetch('/api/chats/' + chatId + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: msgContent }) });
      loadData(); 
    } catch (error) {}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (editingMsg) {
      const newTextContent = content.trim();
      let finalEditedContent = newTextContent;
      if (editingMsg.content.startsWith('> ')) {
        const parts = editingMsg.content.split('\n\n');
        finalEditedContent = `${parts[0]}\n\n${newTextContent}`;
      }
      setContent(''); setEditingMsg(null);
      try { await fetch(`/api/chats/${chatId}/messages/${editingMsg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalEditedContent }) }); loadData(); } catch(e) {}
      return;
    }

    const tempContent = content.trim();
    const finalContent = replyingTo ? `> ${replyingTo.content.replace(/^> .*\n\n/, '')}\n\n${tempContent}` : tempContent;
    setContent(''); setReplyingTo(null);
    
    sendDirectMessage(finalContent);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !activeThread) return;
    const tempContent = commentContent.trim();
    const finalContent = commentReplyingTo ? `> ${commentReplyingTo.content.replace(/^> .*\n\n/, '')}\n\n${tempContent}` : tempContent;
    setCommentContent(''); setCommentReplyingTo(null);
    try {
      const targetChatId = activeThread.chatId || chatId;
      await fetch(`/api/chats/${targetChatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalContent, parentId: activeThread.id }) });
      loadComments(targetChatId, activeThread.id);
    } catch (error) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', 'mesogram-cloud'); 
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) { 
        sendDirectMessage(`[MEDIA] ${data.secure_url}`);
      }
    } catch (err: any) {} 
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
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
    } catch (err: any) {} 
    finally { setIsCommentUploading(false); if (commentFileInputRef.current) commentFileInputRef.current.value = ''; }
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
           newR[reaction].users = [userObj, ...(newR[reaction].users || []).filter((u:any) => u.id !== currentUserId)];
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
      const targetChatId = isComment && activeThread ? (activeThread.chatId || chatId) : chatId;
      await fetch(`/api/chats/${targetChatId}/messages/${msgId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId } }); 
      if (isComment && activeThread) loadComments(targetChatId, activeThread.id);
      else loadData();
    } catch (e) {}
  };

  const openGlobalMenu = (e: React.MouseEvent | React.TouchEvent, item: any, type: 'message' | 'comment') => {
    e.stopPropagation(); e.preventDefault();
    if (photoOpenedRef.current) { photoOpenedRef.current = false; return; }
    let clientX, clientY;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    setContextMenu({ id: item.id, x: clientX, y: clientY, type, item });
  };

  const handleTouchStartPhoto = (e: React.TouchEvent | React.MouseEvent, url: string) => {
    e.stopPropagation();
    photoOpenedRef.current = false;
    pressTimer.current = setTimeout(() => {
      photoOpenedRef.current = true;
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
      setFullScreenImage(url);
      setContextMenu(null);
    }, 400); 
  };
  
  const clearPhotoTimer = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const handlePhotoClick = (e: React.MouseEvent | React.TouchEvent, item: any, type: 'message' | 'comment') => {
    e.stopPropagation();
    e.preventDefault();
    clearPhotoTimer();
    if (photoOpenedRef.current) { photoOpenedRef.current = false; return; }
    openGlobalMenu(e, item, type);
  };

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
    if (msg.content.startsWith('> ')) { setContent(msg.content.split('\n\n').slice(1).join('\n\n')); } 
    else { setContent(msg.content); }
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 
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
    } catch(e) {}
    setIsSavingChat(false);
  };

  const parseContent = (rawText: any) => {
    if (!rawText || typeof rawText !== 'string') return { text: String(rawText || ''), quotedText: null, mediaUrls: [], hasMedia: false, hasText: !!rawText, isVideo: false, voiceUrl: null, videoNoteUrl: null };
    
    let text = rawText;
    let voiceUrl = null;
    let videoNoteUrl = null;

    const voiceMatch = /\[VOICE\]\s*(https?:\/\/[^\s]+)/.exec(text);
    if (voiceMatch) { voiceUrl = voiceMatch[1]; text = text.replace(voiceMatch[0], '').trim(); }

    const videoNoteMatch = /\[VIDEO_NOTE\]\s*(https?:\/\/[^\s]+)/.exec(text);
    if (videoNoteMatch) { videoNoteUrl = videoNoteMatch[1]; text = text.replace(videoNoteMatch[0], '').trim(); }

    const mediaUrls: string[] = [];
    const mediaRegex = /\[MEDIA\]\s*(https?:\/\/[^\s]+)/g;
    let match;
    try {
      while ((match = mediaRegex.exec(text)) !== null) {
        if (match && match[1]) mediaUrls.push(match[1]);
      }
      text = text.replace(mediaRegex, '').trim();
    } catch(e) {}
    
    let quotedText = null;
    try {
      if (text.startsWith('> ')) {
        const parts = text.split('\n\n');
        if (parts.length > 0) { quotedText = parts[0].replace('> ', ''); text = parts.slice(1).join('\n\n'); }
      }
    } catch(e) {}
    
    const hasMedia = mediaUrls.length > 0;
    const hasText = !!text || !!quotedText;
    const isVideo = hasMedia && !!mediaUrls[0] && (mediaUrls[0].match(/\.(mp4|webm|mov|ogg)$/i) || mediaUrls[0].includes('/video/upload/'));
    
    return { text, quotedText, mediaUrls, hasMedia, hasText, isVideo, voiceUrl, videoNoteUrl };
  };

  const lastSeen = chatInfo?.participant?.lastSeen;
  const isOnline = lastSeen ? (Date.now() - lastSeen < 30000) : false; 
  let subtitleText = ""; let subtitleColor = "text-[#86868b] dark:text-[#98989d]"; 

  if (typingUsers.length > 0) {
    if (typingUsers.length === 1) subtitleText = isGroupOrChannel ? `${typingUsers[0]} ${t.isTyping}` : t.isTyping; 
    else subtitleText = `${typingUsers.join(', ')} ${t.areTyping}`;
  } else if (!isSavedChat) {
    if (isGroupOrChannel) {
      if (membersCount === null) subtitleText = isChannel ? t.channel : t.group; 
      else {
        if (isChannel) subtitleText = `${membersCount} ${declOfNum(membersCount, t.subs, lang)}`; 
        else subtitleText = `${membersCount} ${declOfNum(membersCount, t.members, lang)}, ${onlineCount || 1} ${t.onlineCount}`;
      }
    } else {
      subtitleColor = isOnline ? 'text-[#1d1d1f] dark:text-[#f5f5f7] font-medium' : 'text-[#86868b] dark:text-[#98989d]';
      subtitleText = isOnline ? t.online : `${t.lastSeenAt} ${formatLastSeen(lastSeen, lang)}`;
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 relative font-sans overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20 animate-in slide-in-from-right-8 fade-in duration-300 ease-out" onClick={() => setContextMenu(null)}>
      
      {/* ПЛАВАЮЩЕЕ ОКОШКО ДЛЯ ЗАПИСИ КРУЖОЧКОВ */}
      {recordingType === 'video' && (
         <div className="fixed bottom-24 right-4 w-40 h-40 rounded-full overflow-hidden border-[3px] border-[#1d1d1f] dark:border-[#f5f5f7] shadow-2xl z-[100] animate-in zoom-in duration-200">
           <video ref={videoStreamRef} autoPlay muted playsInline className={`w-full h-full object-cover transform ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
           <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-white" />
         </div>
      )}

      {/* ЛАЙТБОКС */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-200 ease-out">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-10">
            <button onClick={() => setFullScreenImage(null)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><X size={24} /></button>
            <button onClick={() => downloadImage(fullScreenImage)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><Download size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden touch-pinch-zoom">
            <img src={fullScreenImage} alt="Media" className="max-w-full max-h-full object-contain select-none" />
          </div>
        </div>
      )}

      {/* ПРОФИЛЬ */}
      {showProfile && chatInfo?.participant && (
        <div className="fixed inset-0 z-[150] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out overflow-y-auto">
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-black/5 dark:border-white/5 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-6">
              <button onClick={() => { setShowProfile(false); setIsEditingChat(false); }} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.info}</h1>
            </div>
            {isAdmin && !isEditingChat && (
              <button onClick={handleEditChatClick} className="p-1 text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-transform"><Edit3 size={24} /></button>
            )}
            {isEditingChat && (
              <button onClick={handleSaveChatSettings} disabled={isSavingChat} className="p-1 text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-transform">
                {isSavingChat ? <Loader2 size={24} className="animate-spin" /> : <Check size={26} strokeWidth={2.5} />}
              </button>
            )}
          </header>
          
          {isEditingChat ? (
            <div className="px-4 pt-8 w-full max-w-lg mx-auto flex flex-col gap-5">
              <div className="flex justify-center mb-4">
                <div className="w-[120px] h-[120px] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] bg-white dark:bg-[#222224] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 relative cursor-pointer" onClick={() => editAvatarRef.current?.click()}>
                  {editChatAvatar && editChatAvatar.length > 5 ? <img src={editChatAvatar} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Camera size={36} className="text-[#86868b] dark:text-[#98989d]" />}
                  {isSavingChat && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={24} className="text-white animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*" className="hidden" ref={editAvatarRef} onChange={handleEditAvatarUpload} />
              </div>
              <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden border border-black/5 dark:border-white/5">
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
            <div className="flex flex-col items-center pt-8 pb-4">
              <div className="w-[120px] h-[120px] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 mb-4">
                {chatInfo.participant.avatarUrl && chatInfo.participant.avatarUrl.length > 5 ? <img src={chatInfo.participant.avatarUrl} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span className="text-[40px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{chatInfo.participant.displayName?.charAt(0).toUpperCase()}</span>}
              </div>
              <h2 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 text-center px-4 tracking-tight">{chatInfo.participant.displayName}</h2>
              {chatInfo.participant.username && <p className="text-[15px] text-[#86868b] dark:text-[#98989d]">{chatInfo.participant.username}</p>}
              <p className={`mt-1.5 text-[13px] font-medium ${subtitleColor}`}>{subtitleText}</p>
              
              {(chatInfo.participant.description || chatInfo.participant.bio) && (
                <div className="mt-4 px-6 w-full text-center">
                  <p className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap bg-white dark:bg-[#222224] p-4 rounded-[16px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5">
                    {chatInfo.participant.description || chatInfo.participant.bio}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ШАПКА ЧАТА */}
      <header className="px-3 pt-10 pb-3 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-white/80 dark:bg-[#222224]/80 backdrop-blur-xl relative z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <Link href="/"><a className="p-2 text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a></Link>
        <div className="flex items-center gap-3.5 cursor-pointer flex-1" onClick={() => !isSavedChat && setShowProfile(true)}>
          <div className="relative w-[44px] h-[44px] shrink-0">
            <div className={`w-full h-full rounded-full flex items-center justify-center font-medium text-[19px] overflow-hidden border border-black/5 dark:border-white/5 ${isSavedChat ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f]' : 'bg-[#e5e5ea] dark:bg-[#333336] text-[#1d1d1f] dark:text-[#f5f5f7]'}`}>
              {isSavedChat ? <Bookmark size={20} fill="currentColor" /> : chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? <img src={chatInfo?.participant?.avatarUrl} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
            </div>
            {!isSavedChat && !isGroupOrChannel && isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#1d1d1f] dark:bg-[#f5f5f7] border-2 border-white dark:border-[#222224] rounded-full z-10"></div>}
          </div>
          <div className="flex flex-col">
            <h2 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] leading-tight truncate pr-2 tracking-tight">{displayName}</h2>
            {subtitleText && <p className={`text-[12px] font-medium mt-0.5 ${subtitleColor}`}>{subtitleText}</p>}
          </div>
        </div>
      </header>

      {/* ОСНОВНОЕ ОКНО СООБЩЕНИЙ */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-4 relative" onClick={() => setContextMenu(null)}>
        <div className="flex flex-col w-full max-w-full">
          {(() => {
            let lastDateStr = '';
            return messages.map((msg: any) => {
              const isMe = String(msg.senderId) === String(currentUserId);
              const { text, quotedText, mediaUrls, hasMedia, hasText, isVideo, voiceUrl, videoNoteUrl } = parseContent(msg.content);
              const dateObj = new Date(msg.createdAt);
              const dateLocale = lang === 'ru' ? 'ru-RU' : 'en-US';
              const currentDateStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
              const showDate = currentDateStr !== '' && currentDateStr !== lastDateStr;
              if (showDate) lastDateStr = currentDateStr;

              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const mReactionsKeys = msg.reactions ? Object.keys(msg.reactions) : [];
              const isMsgUploading = msg.id === uploadingMsgId; // Флаг спиннера

              // КАНАЛЫ
              if (isChannel) {
                return (
                  <div key={msg.id} className="w-full relative mb-5 z-10 animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out">
                    {showDate && (
                      <div className="flex justify-center w-full my-4 relative z-0">
                        <span className="bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#98989d] text-[11px] font-bold px-3 py-1 rounded-full capitalize">
                          {currentDateStr}
                        </span>
                      </div>
                    )}
                    <div 
                      className="w-full bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 flex flex-col cursor-pointer"
                      onClick={(e) => openGlobalMenu(e, msg, 'message')}
                      onContextMenu={(e) => openGlobalMenu(e, msg, 'message')}
                    >
                      {isMsgUploading ? (
                         <div className="p-4 flex items-center justify-center text-[#86868b]">
                            <Loader2 size={24} className="animate-spin mr-2" /> <span>Загрузка...</span>
                         </div>
                      ) : (
                        <>
                          {/* ИСПРАВЛЕНИЕ: ИДЕАЛЬНО ОБРЕЗАННЫЙ КРУЖОЧЕК БЕЗ ФОНА, УВЕЛИЧИВАЕТСЯ ПРИ КЛИКЕ */}
                          {videoNoteUrl && (
                            <div className="p-3 flex justify-center">
                               <div className="relative inline-block w-[240px] h-[240px] rounded-full" onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedVideoMsgId(expandedVideoMsgId === msg.id ? null : msg.id);
                               }}>
                                  <video 
                                    src={videoNoteUrl} autoPlay loop muted playsInline 
                                    className={`w-full h-full rounded-full object-cover shadow-md transition-transform duration-300 ease-out ${expandedVideoMsgId === msg.id ? 'scale-150 z-50 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl' : 'scale-100 z-10'}`} 
                                  />
                                  {expandedVideoMsgId !== msg.id && (
                                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 backdrop-blur-md">
                                        {timeStr}
                                     </div>
                                  )}
                               </div>
                            </div>
                          )}

                          {voiceUrl && (
                            <div className="relative">
                               <VoicePlayer url={voiceUrl} isMe={isMe} timeStr={timeStr} readStatus={isMsgRead(msg, isSavedChat)} isSaved={isSavedChat} />
                            </div>
                          )}

                          {hasMedia && (
                            <div className={`relative w-full flex justify-center bg-[#f5f5f7] dark:bg-[#161618] ${mediaUrls.length > 1 ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                              {mediaUrls.map((url, idx) => (
                                 isVideo 
                                   ? <video key={idx} src={url} controls className="w-full h-auto max-h-[500px] object-cover" onClick={(e) => e.stopPropagation()} />
                                   : <img 
                                        key={idx} src={url} loading="lazy" decoding="async" 
                                        className="w-full h-auto max-h-[500px] object-cover rounded-t-[24px]" 
                                        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                        onTouchStart={(e) => handleTouchStartPhoto(e, url)} 
                                        onMouseDown={(e) => handleTouchStartPhoto(e, url)}
                                        onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                                        onClick={(e) => handlePhotoClick(e, msg, 'message')}
                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, msg, 'message'); }}
                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }} 
                                     />
                              ))}
                            </div>
                          )}
                          
                          {hasText && (
                            <div className="px-5 pt-3.5 pb-2.5">
                               {quotedText && <div className="mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">{quotedText}</div>}
                               <div className="text-[16px] leading-[1.35] break-words whitespace-pre-wrap text-[#1d1d1f] dark:text-[#f5f5f7]">
                                 {text}
                                 {(!voiceUrl && !videoNoteUrl) && (
                                   <span className="float-right inline-flex items-center gap-1 text-[11px] text-[#86868b] dark:text-[#98989d] ml-3 mt-1.5 pointer-events-none select-none">
                                     {timeStr}
                                   </span>
                                 )}
                                 <div className="clear-both"></div>
                               </div>
                            </div>
                          )}
                        </>
                      )}

                      {mReactionsKeys.length > 0 && (
                        <div className="px-4 pb-3 flex flex-wrap gap-1.5 pt-1.5">
                           {mReactionsKeys.map(key => {
                             const rData = msg.reactions[key];
                             const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                             
                             return (
                               <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, key); }} className={`flex items-center justify-center gap-1.5 h-[28px] px-3 rounded-full border transition-transform hover:scale-105 active:scale-95 ${msg.myReaction === key ? 'bg-black/5 dark:bg-white/20 border-black/20 dark:border-white/30 z-10' : 'bg-[#f5f5f7] dark:bg-[#333336] border-black/5 dark:border-white/5 shadow-sm'}`}>
                                 <span className="text-[14px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                                 <span className={`text-[13px] font-bold leading-none flex items-center justify-center mt-[1px] ${msg.myReaction === key ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{count}</span>
                               </button>
                             );
                           })}
                        </div>
                      )}

                      <button onClick={(e) => { e.stopPropagation(); setActiveThread(msg); loadComments(msg.chatId || chatId, msg.id); }} className="w-full flex items-center justify-between px-3 py-2 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-b-[24px]">
                        <div className="flex gap-2 items-center">
                          <MessageCircle size={16} className="text-[#86868b] dark:text-[#98989d]" />
                          <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {(msg.commentsCount || 0) > 0 ? `${msg.commentsCount} ${declOfNum(msg.commentsCount || 0, t.commentsCount, lang)}` : t.comments}
                          </span>
                        </div>
                        <ChevronRight size={16} className="text-[#86868b] dark:text-[#98989d]" />
                      </button>
                    </div>
                  </div>
                );
              }

              // ГРУППЫ И ЛИЧНЫЕ ЧАТЫ (ПУЗЫРИ)
              return (
                <div key={msg.id} className={`flex flex-col w-full mb-1.5 relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out`}>
                  {showDate && (
                    <div className="flex justify-center w-full my-4 relative z-0">
                      <span className="bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#98989d] text-[11px] font-bold px-3 py-1 rounded-full capitalize">{currentDateStr}</span>
                    </div>
                  )}
                  
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} relative`}>
                    
                    {isGroup && !isMe && msg.senderName && (
                      <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] ml-2 mb-1">
                        {msg.senderName}
                      </span>
                    )}

                    <div 
                      className={`shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none relative flex flex-col min-w-[60px] cursor-pointer ${isMe ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] rounded-[18px] rounded-tr-[4px]' : 'bg-white dark:bg-[#222224] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-[18px] rounded-tl-[4px] border border-black/5 dark:border-white/5'}`}
                      onClick={(e) => openGlobalMenu(e, msg, 'message')}
                      onContextMenu={(e) => openGlobalMenu(e, msg, 'message')}
                    >
                      {isMsgUploading ? (
                         <div className="px-4 py-3 flex items-center justify-center opacity-80">
                            <Loader2 size={20} className="animate-spin mr-2" /> <span>Загрузка...</span>
                         </div>
                      ) : (
                        <>
                          {/* ИСПРАВЛЕНИЕ: ИДЕАЛЬНО ОБРЕЗАННЫЙ КРУЖОЧЕК БЕЗ ФОНА, УВЕЛИЧИВАЕТСЯ ПРИ КЛИКЕ */}
                          {videoNoteUrl && (
                            <div className="p-1.5 flex justify-center">
                               <div className={`relative inline-block w-[220px] h-[220px] rounded-full`} onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedVideoMsgId(expandedVideoMsgId === msg.id ? null : msg.id);
                               }}>
                                  <video 
                                    src={videoNoteUrl} autoPlay loop muted playsInline 
                                    className={`w-full h-full rounded-full object-cover shadow-sm transition-transform duration-300 ease-out ${expandedVideoMsgId === msg.id ? 'scale-[1.6] z-50 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl' : 'scale-100 z-10'}`} 
                                  />
                                  {expandedVideoMsgId !== msg.id && (
                                     <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 backdrop-blur-md">
                                        {timeStr}
                                        {isMe && <div className="flex -space-x-1 ml-0.5"><Check size={10} strokeWidth={3}/>{(isMsgRead(msg, isSavedChat)) ? <Check size={10} strokeWidth={3}/> : null}</div>}
                                     </div>
                                  )}
                               </div>
                            </div>
                          )}
                          
                          {/* ГОЛОСОВЫЕ */}
                          {voiceUrl && (
                            <div className={`${hasText ? 'pb-1' : ''}`}>
                               <VoicePlayer url={voiceUrl} isMe={isMe} timeStr={timeStr} readStatus={isMsgRead(msg, isSavedChat)} isSaved={isSavedChat} />
                            </div>
                          )}

                          {/* МЕДИА */}
                          {hasMedia && (
                            <div className={`relative w-full flex justify-center bg-black/5 dark:bg-white/5 ${mediaUrls.length > 1 ? 'grid grid-cols-2 gap-0.5' : ''} ${hasText ? 'rounded-t-[18px]' : 'rounded-[18px]'}`}>
                              {mediaUrls.map((url, idx) => (
                                 isVideo 
                                   ? <video key={idx} src={url} controls className={`w-full h-auto max-h-[400px] object-cover ${hasText ? 'rounded-t-[18px]' : 'rounded-[18px]'}`} onClick={(e) => e.stopPropagation()} />
                                   : <img 
                                        key={idx} src={url} loading="lazy" decoding="async" 
                                        className={`w-full h-auto max-h-[400px] object-cover ${hasText ? 'rounded-t-[18px]' : 'rounded-[18px]'}`} 
                                        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                        onTouchStart={(e) => handleTouchStartPhoto(e, url)} 
                                        onMouseDown={(e) => handleTouchStartPhoto(e, url)}
                                        onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                                        onClick={(e) => handlePhotoClick(e, msg, 'message')}
                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, msg, 'message'); }}
                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }} 
                                     />
                              ))}
                              
                              {(!hasText && !voiceUrl && !videoNoteUrl) && (
                                <div className="absolute bottom-1.5 right-1.5 bg-black/40 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 backdrop-blur-md pointer-events-none">
                                   {timeStr}
                                   {isMe && <div className="flex -space-x-1 ml-0.5"><Check size={11} strokeWidth={2.5}/>{(isMsgRead(msg, isSavedChat)) ? <Check size={11} strokeWidth={2.5}/> : null}</div>}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* ТЕКСТ */}
                          {hasText && (
                            <div className="px-3.5 pt-2 pb-2.5">
                               {quotedText && (
                                 <div className={`mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate ${isMe ? 'border-white/40 dark:border-black/40' : 'border-black/10 dark:border-white/10'}`}>{quotedText}</div>
                               )}
                               <div className="text-[16px] leading-[1.35] break-words whitespace-pre-wrap">
                                 {text}
                                 
                                 {(!voiceUrl && !videoNoteUrl) && (
                                   <span className="float-right inline-flex items-center gap-1 text-[10px] opacity-60 ml-3 mt-1.5 pointer-events-none select-none relative top-[2px]">
                                     {msg.isEdited && <span className="italic mr-0.5">{t.edited}</span>}
                                     {timeStr}
                                     {isMe && <div className="flex -space-x-1 ml-0.5"><Check size={12} strokeWidth={2.5}/>{(isMsgRead(msg, isSavedChat)) ? <Check size={12} strokeWidth={2.5}/> : null}</div>}
                                   </span>
                                 )}
                                 <div className="clear-both"></div>
                               </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {isGroup && (
                       <button onClick={(e) => { e.stopPropagation(); setActiveThread(msg); loadComments(msg.chatId || chatId, msg.id); }} className="w-full flex items-center justify-between px-3 py-2 mt-1 border border-black/5 dark:border-white/5 bg-white dark:bg-[#222224] transition-colors hover:bg-black/5 dark:hover:bg-white/5 rounded-[16px]">
                          <div className="flex gap-2 items-center">
                            <MessageCircle size={16} className="text-[#86868b] dark:text-[#98989d]" />
                            <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                              {(msg.commentsCount || 0) > 0 ? `${msg.commentsCount} ${declOfNum(msg.commentsCount || 0, t.commentsCount, lang)}` : t.comments}
                            </span>
                          </div>
                          <ChevronRight size={16} className="text-[#86868b] dark:text-[#98989d]" />
                        </button>
                    )}
                    
                    {mReactionsKeys.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {mReactionsKeys.map(key => {
                           const rData = msg.reactions[key];
                           const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                           const users = Array.isArray(rData) ? rData : (rData?.users || []);
                           const firstUser = users.length > 0 ? users[0] : null;
                           
                           return (
                             <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, key); }} className={`flex items-center justify-center gap-1 h-[24px] pl-0.5 pr-2.5 rounded-full border transition-transform active:scale-95 ${msg.myReaction === key ? 'bg-black/5 dark:bg-white/20 border-black/20 dark:border-white/30 z-10' : 'bg-[#f5f5f7] dark:bg-[#333336] border-black/5 dark:border-white/5 shadow-sm'}`}>
                               {firstUser ? (
                                 <div className="w-[18px] h-[18px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-[#222224] text-[9px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
                                   {firstUser.avatar ? <img src={firstUser.avatar} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : firstUser.name?.charAt(0).toUpperCase() || 'U'}
                                 </div>
                               ) : <span className="pl-1"></span>}
                               <span className="text-[13px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                               {count > 1 && <span className={`text-[11px] font-bold leading-none flex items-center justify-center mt-[1px] pl-1 ${msg.myReaction === key ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{count}</span>}
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

      {/* МОДАЛКА КОММЕНТАРИЕВ ДЛЯ КАНАЛОВ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out" onClick={() => setContextMenu(null)}>
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.comments}</h1>
            </div>
          </header>
          
          <div ref={commentsScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-10">
            <div className="bg-white dark:bg-[#222224] p-4 rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none mb-2 border border-black/5 dark:border-white/5 flex flex-col">
              <span className="font-semibold text-[14px] text-[#86868b] dark:text-[#98989d] mb-1 block">{activeThread.senderName || t.companion}</span>
              {parseContent(activeThread.content).hasMedia && (
                <div className="flex gap-2 overflow-x-auto my-2">
                  {parseContent(activeThread.content).mediaUrls.map((url: string) => (
                    <img key={url} src={url} className="h-[80px] w-auto rounded-[8px] object-cover border border-black/5 dark:border-white/5" />
                  ))}
                </div>
              )}
              {parseContent(activeThread.content).hasText && (
                <p className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap">{parseContent(activeThread.content).text}</p>
              )}
            </div>
            
            {threadComments.length === 0 ? (
               <div className="text-center text-[#86868b] dark:text-[#98989d] mt-10 font-medium">{t.noComments}</div>
            ) : (
               threadComments.map((c) => {
                 const isMe = String(c.senderId) === String(currentUserId);
                 const { text, quotedText, hasMedia, mediaUrls, hasText, voiceUrl, videoNoteUrl } = parseContent(c.content);
                 const cReactionsKeys = c.reactions ? Object.keys(c.reactions) : [];
                 const timeStr = new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                 return (
                   <div key={c.id} className={`relative flex flex-col mb-2 z-10`}>
                     <div 
                        className="flex gap-3 items-start cursor-pointer" 
                        onClick={(e) => openGlobalMenu(e, c, 'comment')}
                        onContextMenu={(e) => openGlobalMenu(e, c, 'comment')}
                     >
                       <div className="w-9 h-9 rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center shrink-0 overflow-hidden text-[13px] font-medium border border-black/5 dark:border-white/5 text-[#1d1d1f] dark:text-[#f5f5f7]">
                         {c.senderAvatar ? <img src={c.senderAvatar} className="w-full h-full object-cover" /> : c.senderName?.charAt(0).toUpperCase() || 'U'}
                       </div>
                       <div className="flex flex-col flex-1 bg-white dark:bg-[#222224] p-3 rounded-[18px] rounded-tl-[4px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5">
                         <span className="text-[13px] font-semibold mb-1 text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{c.senderName}</span>
                         {quotedText && <div className={`mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]`}>{quotedText}</div>}
                         
                         {videoNoteUrl && (
                           <div className="p-1 flex justify-center">
                              <div className="relative inline-block w-[160px] h-[160px]">
                                <video src={videoNoteUrl} autoPlay loop muted playsInline className={`w-full h-full rounded-full object-cover border-4 border-black/5 dark:border-white/5 shadow-sm`} onClick={e => e.stopPropagation()} />
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/40 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 backdrop-blur-md">
                                   {timeStr}
                                </div>
                              </div>
                           </div>
                         )}
                         
                         {voiceUrl && (
                           <div className={`${hasText ? 'pb-1' : ''}`}>
                              <VoicePlayer url={voiceUrl} isMe={false} timeStr={timeStr} readStatus={true} isSaved={false} />
                           </div>
                         )}

                         {hasMedia && (
                             <img 
                               src={mediaUrls[0]} 
                               className={`max-h-[200px] w-auto object-cover ${hasText ? 'rounded-t-[8px] mb-1' : 'rounded-[8px]'}`} 
                               style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                               onTouchStart={(e) => handleTouchStartPhoto(e, mediaUrls[0])} 
                               onMouseDown={(e) => handleTouchStartPhoto(e, mediaUrls[0])}
                               onTouchEnd={clearPhotoTimer} onTouchMove={clearPhotoTimer} onMouseUp={clearPhotoTimer} onMouseLeave={clearPhotoTimer}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (photoOpenedRef.current) { photoOpenedRef.current = false; return; }
                                 openGlobalMenu(e, c, 'comment');
                               }}
                               onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, c, 'comment'); }}
                             />
                         )}
                         {hasText && <span className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap leading-snug">{text}</span>}
                         
                         {(!voiceUrl && !videoNoteUrl) && (
                           <span className="text-[11px] text-[#86868b] dark:text-[#98989d] mt-1.5 text-right">{timeStr}</span>
                         )}
                       </div>
                     </div>

                     {cReactionsKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 justify-start pl-12">
                          {cReactionsKeys.map(key => {
                             const rData = c.reactions[key];
                             const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                             const users = Array.isArray(rData) ? rData : (rData?.users || []);
                             const firstUser = users.length > 0 ? users[0] : null;

                             return (
                               <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(c.id, key, true); }} className={`flex items-center justify-center gap-1 h-[24px] pl-0.5 pr-2 rounded-full border transition-transform active:scale-95 ${c.myReaction === key ? 'bg-black/5 dark:bg-white/20 border-black/20 dark:border-white/30 z-10' : 'bg-[#f5f5f7] dark:bg-[#333336] border-black/5 dark:border-white/5 shadow-sm'}`}>
                                 {firstUser ? (
                                   <div className="w-[18px] h-[18px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-[#222224] text-[9px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
                                     {firstUser.avatar ? <img src={firstUser.avatar} className="w-full h-full object-cover" /> : firstUser.name?.charAt(0).toUpperCase() || 'U'}
                                   </div>
                                 ) : <span className="pl-1"></span>}
                                 <span className="text-[13px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                                 {count > 1 && <span className={`text-[11px] font-bold leading-none flex items-center justify-center mt-[1px] pl-1 ${c.myReaction === key ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{count}</span>}
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
                <button type="button" onClick={() => setCommentReplyingTo(null)} className="p-1.5 flex-shrink-0 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"><X size={16} /></button>
              </div>
             )}
            <form onSubmit={handleSendComment} className="p-3 flex items-center gap-2 pb-6">
              <input type="file" accept="image/*,video/*" className="hidden" ref={commentFileInputRef} onChange={handleCommentFileUpload} />
              <button type="button" onClick={() => commentFileInputRef.current?.click()} disabled={isCommentUploading} className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors disabled:opacity-50">
                {isCommentUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}
              </button>
              <input 
                className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-full px-5 py-2.5 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-[15px] transition-colors focus:border-black/20 dark:focus:border-white/20" 
                value={commentContent} 
                onChange={e => setCommentContent(e.target.value)} 
                placeholder={t.commentPlaceholder} 
              />
              <button type="submit" disabled={!commentContent.trim()} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none">
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ФОРМА ОТПРАВКИ СООБЩЕНИЯ В ЧАТ */}
      {!activeThread && (
        <div className="bg-white/80 dark:bg-[#222224]/80 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col backdrop-blur-xl">
          {(replyingTo || editingMsg) && (
            <div className="flex items-center justify-between mb-1 mt-3 mx-4 px-4 py-2.5 bg-[#f5f5f7] dark:bg-[#161618] rounded-[14px] border-l-[3px] border-[#1d1d1f] dark:border-[#f5f5f7]">
              <div className="flex flex-col mr-4">
                <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase">{editingMsg ? t.editing : t.replyAction}</span>
                <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate">
                  {editingMsg ? (parseContent(editingMsg.content).text || t.photo) : (parseContent(replyingTo.content).text || t.photo)}
                </span>
              </div>
              <button type="button" onClick={() => { setReplyingTo(null); setEditingMsg(null); setContent(''); }} className="p-1.5 flex-shrink-0 text-[#86868b]"><X size={16} /></button>
            </div>
          )}
          
          {(!isGroupOrChannel || isMember) && !(isChannel && !isAdmin) ? (
            recordingType ? (
               <div className="p-3 flex items-center justify-between pb-6 bg-[#f5f5f7] dark:bg-[#161618]">
                 <div className="flex items-center gap-3">
                   <button onClick={() => stopRecording(true)} className="text-red-500 p-2 active:scale-95"><Trash2 size={24} /></button>
                   {/* КНОПКА ПЕРЕВОРОТА КАМЕРЫ ДЛЯ КРУЖОЧКОВ */}
                   {recordingType === 'video' && (
                     <button onClick={toggleCamera} className="text-[#86868b] p-2 active:scale-95"><RefreshCw size={22} /></button>
                   )}
                 </div>
                 
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[#86868b] text-[11px] font-medium tracking-wide mb-1">{t.cancel}</span>
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                       <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px] font-semibold">{formatTime(recordingTime)}</span>
                    </div>
                 </div>
                 <button onClick={() => stopRecording(false)} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center active:scale-95 transition-transform"><ArrowUp size={20} strokeWidth={2.5} /></button>
               </div>
            ) : (
              <form onSubmit={handleSend} className="p-3 flex items-center gap-2 pb-6">
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#86868b] disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">{isUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}</button>
                <input ref={inputRef} className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-[20px] px-4 py-2 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px]" value={content} onChange={(e) => { setContent(e.target.value); if (Date.now() - lastTypingTime.current > 2000) { lastTypingTime.current = Date.now(); socket?.emit('typing', { chatId, name: currentUser?.displayName }); } }} placeholder={t.messagePlaceholder} />
                
                {/* ИСПРАВЛЕНИЕ: КНОПКА МИКРОФОНА/КАМЕРЫ/ОТПРАВИТЬ С АНИМАЦИЕЙ */}
                {!content.trim() ? (
                  <button
                     type="button"
                     onMouseDown={handleRecordTouchStart}
                     onMouseUp={handleRecordTouchEnd}
                     onTouchStart={handleRecordTouchStart}
                     onTouchEnd={handleRecordTouchEnd}
                     onMouseLeave={handleRecordTouchEnd}
                     className="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center text-[#86868b] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none relative"
                     style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  >
                     <div className={`transition-transform duration-150 absolute inset-0 flex items-center justify-center ${isAnimatingIcon ? 'scale-0' : 'scale-100'}`}>
                        {recordMode === 'voice' ? <Mic size={24} strokeWidth={1.5} /> : <Camera size={24} strokeWidth={1.5} />}
                     </div>
                  </button>
                ) : (
                  // ИСПРАВЛЕНИЕ: КНОПКА ОТПРАВИТЬ (СТРЕЛОЧКА ВВЕРХ)
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

      {/* МЕНЮ ДЛЯ УДАЛЕНИЯ / РЕДАКТИРОВАНИЯ */}
      {contextMenu && (() => {
         const menuWidth = 220; const menuHeight = 250;
         let safeX = contextMenu.x; let safeY = contextMenu.y;
         
         if (safeX + menuWidth > window.innerWidth) safeX = window.innerWidth - menuWidth - 10;
         if (safeY + menuHeight > window.innerHeight) safeY = safeY - menuHeight;
         if (safeY < 0) safeY = 20;
         
         const isMe = String(contextMenu.item.senderId) === String(currentUserId);
         const { hasText, hasMedia, voiceUrl, videoNoteUrl } = parseContent(contextMenu.item.content);
         
         const showReply = contextMenu.type === 'comment' || !isChannel;
         const showCopy = hasText;
         const showEdit = isMe && !hasMedia && !voiceUrl && !videoNoteUrl && contextMenu.type === 'message';
         const showDelete = isMe;

         if (!showReply && !showCopy && !showEdit && !showDelete) return null;

         return (
           <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
             <div className="absolute flex flex-col gap-2 animate-in zoom-in-[0.95] fade-in duration-200" style={{ top: safeY, left: safeX }} onClick={e => e.stopPropagation()}>
                <div className="flex gap-1.5 p-2 bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-full shadow-lg border border-black/5 dark:border-white/5">
                   {FAST_REACTIONS.map(emoji => (
                     <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(contextMenu.id, emoji, contextMenu.type === 'comment'); }} className="w-8 h-8 flex items-center justify-center text-[20px] rounded-full hover:scale-125 transition-transform active:scale-95">{emoji}</button>
                   ))}
                </div>
                <div className="flex flex-col bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-[20px] shadow-lg border border-black/5 dark:border-white/5 overflow-hidden w-full">
                   {showReply && (
                     <button onClick={(e) => { e.stopPropagation(); if (contextMenu.type === 'comment') setCommentReplyingTo(contextMenu.item); else setReplyingTo(contextMenu.item); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Reply size={18} className="text-[#86868b]" /> {t.replyAction}</button>
                   )}
                   {showCopy && (
                     <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(parseContent(contextMenu.item.content).text); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Copy size={18} className="text-[#86868b]" /> {t.copy}</button>
                   )}
                   {showEdit && (
                     <button onClick={(e) => { e.stopPropagation(); setContextMenu(null); startEditing(contextMenu.item); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"><Edit2 size={18} className="text-[#86868b]" /> {t.editAction}</button>
                   )}
                   {showDelete && (
                     <button onClick={(e) => { e.stopPropagation(); if (contextMenu.type === 'comment') deleteMessage(contextMenu.id, true); else deleteMessage(contextMenu.id); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/5"><Trash2 size={18} className="text-[#86868b]" /> {t.deleteAction}</button>
                   )}
                </div>
             </div>
           </div>
         );
      })()}
    </div>
  );
}
