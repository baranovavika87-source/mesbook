import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Trash2, Edit2, Loader2, Check, X, Paperclip, Bookmark, Calendar, Volume2, Edit3, Camera, ChevronRight, Download, Smile, MessageCircle, Send } from 'lucide-react';
import { io } from 'socket.io-client'; // НОВОЕ: Импорт WebSockets

// Инициализация глобального сокета
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
    lastSeenAt: "Был(а) в",
    recently: "Недавно",
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
    isTyping: "печатает...",
    areTyping: "печатают..."
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
    lastSeenAt: "Last seen at",
    recently: "Recently",
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
    isTyping: "is typing...",
    areTyping: "are typing..."
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

export default function ChatPage() {
  const [match, params] = useRoute('/chat/:chatId');
  const chatId = params?.chatId;
  const numericChatId = Number(chatId);
  const isGroupOrChannel = numericChatId >= 100000000;
  const isSavedChat = chatId === 'saved';
  const currentUserId = getUserId();

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
  const [readFailed, setReadFailed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState<number | null>(null);
  
  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  
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
  const editAvatarRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottom = useRef(false);

  const [chatInfo, setChatInfo] = useState<any>(() => {
    if (isSavedChat) return { participant: { displayName: t.saved, isSaved: true } };
    try {
      const savedChats = JSON.parse(localStorage.getItem('mesbook_chats_' + currentUserId) || '[]');
      return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
    } catch(e) { return null; }
  });

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = isSavedChat ? t.saved : (chatInfo?.participant?.displayName || chatInfo?.name || savedName || t.companion);
  const isGroup = chatInfo?.participant?.isGroup;
  const isChannel = chatInfo?.participant?.isChannel;

  // НОВОЕ: Подключение к WebSockets для мгновенного обновления
  useEffect(() => {
    if (!socket) socket = io(window.location.origin, { path: '/socket.io' });
    
    if (!isSavedChat) {
      socket.emit('join', String(chatId));

      const handleUpdate = (updatedChatId: number) => {
        if (Number(updatedChatId) === Number(chatId)) loadData();
      };
      
      const handleTyping = (data: any) => {
        if (Number(data.chatId) === Number(chatId) && data.name !== currentUser?.displayName) {
          setTypingUsers(prev => prev.includes(data.name) ? prev : [...prev, data.name]);
          setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== data.name)), 3000);
        }
      };

      socket.on('chat_update', handleUpdate);
      socket.on('typing', handleTyping);

      return () => {
        socket.off('chat_update', handleUpdate);
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

  const loadData = async () => {
    if (isSavedChat) return;
    try { await fetch('/api/chats/' + chatId + '/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {}
    try {
      const infoRes = await fetch('/api/chats', { headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' } });
      if (infoRes.ok) {
        const data = await infoRes.json();
        const currentChat = data.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId));
        if (currentChat) setChatInfo(currentChat);
      }
    } catch (e) {}
    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (msgRes.ok) {
        const data = await msgRes.json();
        const serverMsgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages((prev: any) => {
          const sendingMsgs = prev.filter((m: any) => m.isSending);
          const filteredSending = sendingMsgs.filter((sm: any) => !serverMsgs.find((dm: any) => dm.content === sm.content));
          return [...serverMsgs, ...filteredSending].sort((a: any, b: any) => a.id - b.id);
        });
      }
    } catch (e) {}
    
    if (activeThread) {
       try {
         const commRes = await fetch(`/api/chats/${chatId}/messages/${activeThread.id}/comments`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
         if (commRes.ok) setThreadComments(await commRes.json());
       } catch(e) {}
    }
  };

  useEffect(() => {
    loadData();
    if (!isSavedChat) {
      // ИСПРАВЛЕНИЕ: Мы убрали агрессивный пуллинг, оставив легкий чек раз в 15 секунд на случай разрыва сокета
      const interval = setInterval(loadData, 15000);
      return () => clearInterval(interval);
    }
  }, [chatId, activeThread]);

  useEffect(() => {
    if (scrollRef.current && !hasScrolledToBottom.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      hasScrolledToBottom.current = true;
    }
  }, [messages]);

  const forceScrollToBottom = () => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 10); };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (editingMsg) {
      const newTextContent = content.trim();
      const tempId = editingMsg.id;
      let finalEditedContent = newTextContent;
      if (editingMsg.content.startsWith('> ')) {
        const parts = editingMsg.content.split('\n\n');
        finalEditedContent = `${parts[0]}\n\n${newTextContent}`;
      }
      
      if (isSavedChat) {
        setMessages((prev: any) => {
          const updated = prev.map((m: any) => m.id === tempId ? { ...m, content: finalEditedContent, isEdited: true } : m);
          localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(updated));
          return updated;
        });
        setContent('');
        setEditingMsg(null);
        return;
      }

      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: finalEditedContent, isEdited: true } : m));
      setContent('');
      setEditingMsg(null);
      try {
        await fetch(`/api/chats/${chatId}/messages/${tempId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalEditedContent }) });
        loadData();
      } catch(e) {}
      return;
    }

    const tempContent = content.trim();
    const finalContent = replyingTo ? `> ${replyingTo.content}\n\n${tempContent}` : tempContent;
    setContent('');
    setReplyingTo(null);
    
    const tempMsg = { id: Date.now(), content: finalContent, isSending: !isSavedChat, senderId: currentUserId, createdAt: new Date().toISOString() };
    if (isSavedChat) {
      setMessages((prev: any) => { const u = [...prev, { ...tempMsg, isSending: false }]; localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(u)); return u; });
      forceScrollToBottom(); return;
    }
    setMessages((prev: any) => [...prev, tempMsg]);
    forceScrollToBottom();
    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: finalContent }) });
      if (res.ok) loadData(); else setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id));
    } catch (error) { setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id)); }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !activeThread) return;
    const txt = commentContent.trim();
    setCommentContent('');
    try {
      await fetch('/api/chats/' + chatId + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: txt, parentId: activeThread.id }) });
      loadData();
    } catch (error) {}
  };

  const startEditing = (msg: any) => {
    setEditingMsg(msg);
    if (msg.content.startsWith('> ')) { setContent(msg.content.split('\n\n').slice(1).join('\n\n')); } 
    else { setContent(msg.content); }
    setReplyingTo(null);
  };

  const joinChat = async () => {
    try { await fetch(`/api/chats/${chatId}/join`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); setIsMember(true); loadData(); } catch (e) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) { 
        await fetch('/api/chats/' + chatId + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: `[MEDIA] ${data.secure_url}` }) });
        loadData();
      }
    } catch (err: any) {} 
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDelete = async (msgId: number) => {
    if (!window.confirm(t.deleteConfirm)) return;
    if (isSavedChat) {
      const updated = messages.filter((m: any) => m.id !== msgId);
      setMessages(updated);
      localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(updated));
      return;
    }
    try { await fetch('/api/chats/' + chatId + '/messages/' + msgId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId } }); loadData(); } catch (e) {}
  };

  const toggleReaction = async (msgId: number, reaction: string) => {
    try {
      await fetch(`/api/chats/${chatId}/messages/${msgId}/reaction`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ reaction }) });
    } catch (e) {}
    setActiveReactionMsg(null);
  };

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `mesogram_photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (e) { window.open(url, '_blank'); }
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

  const lastSeen = chatInfo?.participant?.lastSeen;
  const isOnline = lastSeen ? (Date.now() - lastSeen < 3 * 60 * 1000) : false;
  
  let subtitleText = "";
  let subtitleColor = "text-gray-400 dark:text-zinc-500"; 

  if (typingUsers.length > 0) {
    if (typingUsers.length === 1) { subtitleText = isGroupOrChannel ? `${typingUsers[0]} ${t.isTyping}` : t.isTyping; } 
    else { subtitleText = `${typingUsers.join(', ')} ${t.areTyping}`; }
  } else if (!isSavedChat) {
    if (isGroupOrChannel) {
      if (membersCount === null) { subtitleText = isChannel ? t.channel : t.group; } 
      else {
        if (isChannel) { subtitleText = `${membersCount} ${declOfNum(membersCount, t.subs, lang)}`; } 
        else { subtitleText = `${membersCount} ${declOfNum(membersCount, t.members, lang)}, ${onlineCount || 1} ${t.onlineCount}`; }
      }
    } else {
      subtitleColor = isOnline ? 'text-black dark:text-white font-medium' : 'text-gray-400 dark:text-zinc-500';
      subtitleText = isOnline ? t.online : (lastSeen ? `${t.lastSeenAt} ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : t.recently);
    }
  }

  const renderMessageContent = (msgContent: string, isMe: boolean) => {
    if (msgContent.startsWith('[MEDIA] ')) {
      let url = msgContent.replace('[MEDIA] ', '').trim();
      const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/');
      if (!isVideo && url.match(/\.(heic|heif)$/i)) url = url.replace(/\.(heic|heif)$/i, '.jpg');
      
      return (
        <div className="relative flex items-center justify-center overflow-hidden rounded-[16px]">
          {isVideo ? (
            <video src={url} controls className="w-full h-auto max-w-[280px] max-h-[400px] object-contain" />
          ) : (
            <img 
              onClick={() => setFullScreenImage(url)}
              src={url} 
              alt="Media" 
              className="w-full h-auto max-w-[280px] max-h-[400px] object-contain min-h-[120px] min-w-[120px] bg-gray-100/5 dark:bg-white/5 cursor-pointer" 
              onError={(e) => { e.currentTarget.src = 'https://placehold.co/280x200/1c1c1e/ffffff?text=Image+Not+Found'; }}
            />
          )}
        </div>
      );
    }
    
    if (msgContent.startsWith('> ')) {
      const parts = msgContent.split('\n\n');
      let quotedText = parts[0].replace('> ', '');
      if (quotedText.startsWith('[MEDIA]')) { quotedText = t.photo; }
      const replyText = parts.slice(1).join('\n\n');

      return (
        <div className="mb-1 flex flex-col w-full overflow-hidden">
          <div className={'pl-2 border-l-[3px] text-[12px] font-medium opacity-80 mb-1.5 truncate max-w-full ' + (isMe ? 'border-white/40 dark:border-black/40' : 'border-black/30 dark:border-white/30')}>
            {quotedText}
          </div>
          <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">{replyText}</p>
        </div>
      );
    }
    return <p className="text-[15px] leading-[1.3] break-words whitespace-pre-wrap">{msgContent}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative font-sans overflow-hidden">
      
      {/* ЛАЙТБОКС */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-10">
            <button onClick={() => setFullScreenImage(null)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><X size={24} /></button>
            <button onClick={() => downloadImage(fullScreenImage)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><Download size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden touch-pinch-zoom">
            <img src={fullScreenImage} alt="Fullscreen Media" className="max-w-full max-h-full object-contain select-none" />
          </div>
        </div>
      )}

      {/* МОДАЛКА КОММЕНТАРИЕВ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f2f2f7] dark:bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-black dark:text-white">{t.comments}</h1>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] shadow-sm mb-2 border border-gray-100/50 dark:border-zinc-800">
              {renderMessageContent(activeThread.content, false)}
            </div>
            
            {threadComments.length === 0 ? (
               <div className="text-center text-gray-400 dark:text-zinc-600 mt-10 font-medium">{t.noComments}</div>
            ) : (
               threadComments.map(c => (
                 <div key={c.id} className="flex gap-3 items-start">
                   <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden text-[12px] font-medium border border-gray-300/30 dark:border-zinc-700">
                     {c.senderAvatar ? <img src={c.senderAvatar} className="w-full h-full object-cover" /> : c.senderName.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex flex-col flex-1 bg-white dark:bg-[#1c1c1e] p-3 rounded-[16px] rounded-tl-none shadow-sm border border-gray-100/50 dark:border-zinc-800">
                     <span className="text-[12px] font-bold mb-1 text-black dark:text-white">{c.senderName}</span>
                     <span className="text-[14px] text-black dark:text-white whitespace-pre-wrap leading-snug">{c.content}</span>
                     <span className="text-[10px] text-gray-400 mt-1 text-right">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                 </div>
               ))
            )}
          </div>
          
          <form onSubmit={handleSendComment} className="p-3 bg-[#f2f2f7] dark:bg-black border-t border-gray-200/50 dark:border-zinc-900/50 flex items-center gap-2 pb-6">
            <input 
              className="flex-1 bg-white dark:bg-[#1c1c1e] border border-gray-200/50 dark:border-zinc-800 rounded-full px-5 py-2.5 outline-none text-black dark:text-white placeholder-gray-400 text-[15px] shadow-sm focus:border-black dark:focus:border-white" 
              value={commentContent} 
              onChange={e => setCommentContent(e.target.value)} 
              placeholder={t.commentPlaceholder} 
            />
            <button type="submit" disabled={!commentContent.trim()} className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95 shadow-sm">
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------
          ПРОФИЛЬ
      --------------------------------------------------------- */}
      {showProfile && chatInfo?.participant && (
        <div className="fixed inset-0 z-50 bg-[#f2f2f7] dark:bg-black flex flex-col animate-in slide-in-from-bottom duration-200 overflow-y-auto">
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-6">
              <button onClick={() => { setShowProfile(false); setIsEditingChat(false); }} className="text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[20px] font-semibold text-black dark:text-white">{t.info}</h1>
            </div>
            
            {isAdmin && !isEditingChat && (
              <button onClick={handleEditChatClick} className="p-1 text-black dark:text-white active:scale-95 transition-transform"><Edit3 size={24} /></button>
            )}
            
            {isEditingChat && (
              <button onClick={handleSaveChatSettings} disabled={isSavingChat} className="p-1 text-black dark:text-white active:scale-95 transition-transform">
                {isSavingChat ? <Loader2 size={24} className="animate-spin" /> : <Check size={26} strokeWidth={2.5} />}
              </button>
            )}
          </header>
          
          {isEditingChat ? (
            <div className="px-4 pt-8 w-full max-w-lg mx-auto flex flex-col gap-5">
              <div className="flex justify-center mb-4">
                <div className="w-[120px] h-[120px] rounded-full shadow-md bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-800 relative cursor-pointer" onClick={() => editAvatarRef.current?.click()}>
                  {editChatAvatar && editChatAvatar.length > 5 ? <img src={editChatAvatar} className="w-full h-full object-cover" /> : <Camera size={36} className="text-gray-400" />}
                  {isSavingChat && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={24} className="text-white animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*" className="hidden" ref={editAvatarRef} onChange={handleEditAvatarUpload} />
              </div>

              <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm overflow-hidden border border-gray-100/50 dark:border-zinc-800/50">
                <div className="px-5 py-2.5 border-b border-gray-100/50 dark:border-zinc-900/60">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">{t.name}</label>
                  <input type="text" value={editChatName} onChange={e => setEditChatName(e.target.value)} className="w-full bg-transparent py-1.5 text-[17px] font-medium text-black dark:text-white outline-none" />
                </div>
                <div className="px-5 py-4">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t.desc}</label>
                  <textarea rows={4} value={editChatDesc} onChange={e => setEditChatDesc(e.target.value)} className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none resize-none" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center pt-8 pb-4">
                <div className="w-[120px] h-[120px] rounded-full shadow-md bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-800 mb-4">
                  {chatInfo.participant.avatarUrl && chatInfo.participant.avatarUrl.length > 5 ? <img src={chatInfo.participant.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-[40px] font-medium text-black dark:text-white">{chatInfo.participant.displayName?.charAt(0).toUpperCase()}</span>}
                </div>
                <h2 className="text-[22px] font-bold text-black dark:text-white mb-1 text-center px-4">{chatInfo.participant.displayName}</h2>
                {chatInfo.participant.username && <p className="text-[15px] text-gray-500">{chatInfo.participant.username}</p>}
                <p className={`mt-1.5 text-[13px] font-medium ${subtitleColor}`}>{subtitleText}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------
          ШАПКА ЧАТА
      --------------------------------------------------------- */}
      <header className="px-3 pt-10 pb-3 border-b border-gray-200/50 dark:border-zinc-900/50 flex items-center gap-3 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md relative z-10 shadow-sm">
        <Link href="/"><a className="p-2 text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a></Link>
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => !isSavedChat && setShowProfile(true)}>
          <div className="relative w-[44px] h-[44px] shrink-0">
            <div className={`w-full h-full rounded-full flex items-center justify-center font-medium text-[19px] overflow-hidden border border-gray-200/50 dark:border-zinc-700/50 ${isSavedChat ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-zinc-800 text-black dark:text-white'}`}>
              {isSavedChat ? <Bookmark size={20} fill="currentColor" /> : chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? <img src={chatInfo?.participant?.avatarUrl} className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
            </div>
            {!isSavedChat && !isGroupOrChannel && isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-black dark:bg-white border-2 border-white dark:border-[#1c1c1e] rounded-full z-10"></div>}
          </div>
          <div className="flex flex-col">
            <h2 className="font-semibold text-black dark:text-white text-[16px] leading-tight truncate pr-2">{displayName}</h2>
            {subtitleText && <p className={`text-[12px] font-medium mt-0.5 ${subtitleColor}`}>{subtitleText}</p>}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------
          ОСНОВНОЕ ОКНО СООБЩЕНИЙ
      --------------------------------------------------------- */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 relative" onClick={() => setActiveReactionMsg(null)}>
        <div className="flex flex-col">
          {(() => {
            let lastDateStr = '';
            
            return messages.map((msg: any) => {
              const isMe = String(msg.senderId) === String(currentUserId);
              const isMedia = msg.content.startsWith('[MEDIA] ');
              const dateObj = new Date(msg.createdAt);
              const dateLocale = lang === 'ru' ? 'ru-RU' : 'en-US';
              const currentDateStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
              const showDate = currentDateStr !== '' && currentDateStr !== lastDateStr;
              if (showDate) lastDateStr = currentDateStr;

              const reactionsKeys = msg.reactions ? Object.keys(msg.reactions) : [];

              return (
                <div key={msg.id} className="flex flex-col w-full mb-1.5 relative">
                  {showDate && (
                    <div className="flex justify-center my-3 w-full">
                      <span className="bg-gray-400/20 dark:bg-zinc-700/50 text-gray-600 dark:text-zinc-300 text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm shadow-sm capitalize">
                        {currentDateStr}
                      </span>
                    </div>
                  )}
                  
                  <div className={'flex flex-col max-w-[80%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')} onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchStartRef.current !== null) { const touchEndX = e.changedTouches[0].clientX; const diff = touchStartRef.current - touchEndX; if (diff > 50) { setReplyingTo(msg); if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40); } touchStartRef.current = null; } }}>
                    
                    <div className={
                      isMedia 
                        ? `relative shadow-sm p-1 bg-white dark:bg-[#1c1c1e] border border-gray-100/50 dark:border-zinc-800 rounded-[20px] ${isMe ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]'}`
                        : `shadow-sm relative min-w-[75px] px-3.5 pt-2 pb-5 ${isMe ? (isMedia ? 'pr-12' : 'pr-[68px]') + ' bg-black dark:bg-white text-white dark:text-black rounded-tr-[4px]' : 'pr-12 bg-white dark:bg-[#1c1c1e] text-black dark:text-white rounded-tl-[4px] border border-gray-100/50 dark:border-zinc-800'} rounded-[20px]`
                    }>
                      
                      {renderMessageContent(msg.content, isMe)}
                      
                      {reactionsKeys.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${isMedia ? 'absolute -bottom-3 left-2' : ''}`}>
                          {reactionsKeys.map(key => (
                             <button 
                               key={key} 
                               onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, key); }}
                               className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${msg.myReaction === key ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-white/80 dark:bg-black/80 text-black dark:text-white border-gray-200 dark:border-zinc-700'}`}
                             >
                               <span>{key}</span>
                               <span className={msg.myReaction === key ? 'text-black dark:text-white' : 'text-gray-500'}>{msg.reactions[key]}</span>
                             </button>
                          ))}
                        </div>
                      )}

                      <div className={`absolute flex items-center justify-end gap-1 text-[10px] font-medium ${isMedia ? 'bottom-2.5 right-2.5 bg-black/50 text-white px-2.5 py-1 rounded-full backdrop-blur-md z-10' : 'bottom-1 right-2.5 text-gray-400 dark:text-zinc-500'}`}>
                        <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        {msg.isEdited && !isMedia && <span className="opacity-70 ml-0.5 mr-0.5 text-[9px] italic">• {t.edited}</span>}
                        
                        {!msg.isSending && (
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveReactionMsg(activeReactionMsg === msg.id ? null : msg.id); }} className="hover:text-gray-300 ml-1 transition-colors cursor-pointer z-20">
                            <Smile size={12} />
                          </button>
                        )}

                        {isMe && (
                          <div className="flex items-center ml-0.5">
                            {isSavedChat || isGroupOrChannel ? (
                              <div className="flex -space-x-1"><Check size={11} strokeWidth={2.5} /><Check size={11} strokeWidth={2.5} /></div>
                            ) : msg.isSending ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <div className="flex -space-x-1">
                                <Check size={11} strokeWidth={2.5} />
                                {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && <Check size={11} strokeWidth={2.5} />}
                              </div>
                            )}
                            
                            {!msg.isSending && (
                              <>
                                {!isMedia && (
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(msg); }} className="hover:text-gray-300 ml-1.5 transition-colors cursor-pointer z-20"><Edit2 size={12} /></button>
                                )}
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(msg.id); }} className="hover:text-gray-300 ml-1.5 transition-colors cursor-pointer z-20"><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {activeReactionMsg === msg.id && (
                        <div className={`absolute z-50 flex gap-2 p-2 bg-white dark:bg-[#1c1c1e] rounded-full shadow-lg border border-gray-200/50 dark:border-zinc-800 ${isMe ? 'right-0 -top-12' : 'left-0 -top-12'}`}>
                           {FAST_REACTIONS.map(emoji => (
                             <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }} className="w-8 h-8 flex items-center justify-center text-[20px] hover:scale-125 transition-transform active:scale-95">
                               {emoji}
                             </button>
                           ))}
                        </div>
                      )}
                    </div>
                    
                    {isGroupOrChannel && (
                      <button 
                        onClick={() => { setActiveThread(msg); setThreadComments([]); }}
                        className={`mt-1.5 flex items-center gap-1.5 px-3 py-1 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm rounded-full text-[11px] font-bold text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-zinc-700/50 shadow-sm active:scale-95 transition-all ${isMe ? 'mr-1' : 'ml-1'}`}
                      >
                        <MessageCircle size={12} />
                        {msg.commentsCount > 0 ? `${msg.commentsCount} ${t.comments}` : t.comments}
                      </button>
                    )}

                  </div>
                </div>
              );
            });
          })()}
        </div>
      </main>

      <div className="p-3 bg-[#f2f2f7] dark:bg-black border-t border-gray-200/50 dark:border-zinc-900/50 pb-6 relative z-10 flex flex-col">
        {(replyingTo || editingMsg) && (
          <div className="flex items-center justify-between mb-2 mx-1 px-4 py-2.5 bg-white dark:bg-[#1c1c1e] rounded-[16px] border-l-[3px] border-black dark:border-white shadow-sm">
            <div className="flex flex-col overflow-hidden mr-4">
              <span className="text-[11px] font-bold text-black dark:text-white uppercase tracking-wider mb-0.5">
                {editingMsg ? t.editing : t.reply}
              </span>
              <span className="text-[13px] text-gray-500 dark:text-zinc-400 truncate">
                {editingMsg 
                  ? (editingMsg.content.startsWith('[MEDIA]') ? t.photo : (editingMsg.content.startsWith('> ') ? editingMsg.content.split('\n\n').slice(1).join('\n\n') : editingMsg.content)) 
                  : (replyingTo.content.startsWith('[MEDIA]') ? t.photo : replyingTo.content.replace(/^> .*\n\n/, ''))}
              </span>
            </div>
            <button type="button" onClick={() => { setReplyingTo(null); setEditingMsg(null); setContent(''); }} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-black dark:hover:text-white rounded-full transition-colors"><X size={18} /></button>
          </div>
        )}

        {!isMember ? (
          <div className="flex items-center justify-center pt-1 px-1">
            <button onClick={joinChat} className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-[20px] shadow-sm transition-transform active:scale-95 text-[16px]">
              {isChannel ? t.subscribe : t.joinGroup}
            </button>
          </div>
        ) : (isChannel && !isAdmin) ? (
          <div className="flex items-center justify-center pt-2 pb-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-500 hover:text-black dark:hover:text-white transition-colors text-[16px] font-medium active:scale-95"
            >
              {isMuted ? t.unmute : t.mute}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2 px-1">
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-10 h-10 shrink-0 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50">
              {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={24} />}
            </button>
            <input 
              className="flex-1 bg-white dark:bg-[#1c1c1e] border border-gray-200/50 dark:border-zinc-800 rounded-full px-5 py-2.5 outline-none text-black dark:text-white placeholder-gray-400 text-[16px] shadow-sm transition-colors focus:border-gray-300 dark:focus:border-zinc-600" 
              value={content} 
              onChange={(e) => {
                setContent(e.target.value);
                if (Date.now() - lastTypingTime.current > 2000) {
                  lastTypingTime.current = Date.now();
                  socket?.emit('typing', { chatId, name: currentUser?.displayName });
                }
              }} 
              placeholder={t.messagePlaceholder} 
            />
            <button type="submit" disabled={!content.trim()} className="w-[36px] h-[36px] flex-shrink-0 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 transition-colors active:scale-95 shadow-sm ml-1">
              <ChevronRight size={22} strokeWidth={2.5} className="ml-0.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
