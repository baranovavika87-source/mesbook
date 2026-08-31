import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check, X, Paperclip, Bookmark, Calendar, Volume2 } from 'lucide-react';

const getUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}'); return u.id || u.userId || u._id || 1; } catch (e) { return 1; }
};

export default function ChatPage() {
  const [match, params] = useRoute('/chat/:chatId');
  const chatId = params?.chatId;
  const numericChatId = Number(chatId);
  const isGroupOrChannel = numericChatId >= 100000000;
  const isSavedChat = chatId === 'saved';
  const currentUserId = getUserId();

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
  const [isUploading, setIsUploading] = useState(false);
  const [isMember, setIsMember] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottom = useRef(false);

  const [chatInfo, setChatInfo] = useState<any>(() => {
    if (isSavedChat) return { participant: { displayName: 'Избранное', isSaved: true } };
    try {
      const savedChats = JSON.parse(localStorage.getItem('mesbook_chats_' + currentUserId) || '[]');
      return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
    } catch(e) { return null; }
  });

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = isSavedChat ? 'Избранное' : (chatInfo?.participant?.displayName || chatInfo?.name || savedName || 'Собеседник');
  const isGroup = chatInfo?.participant?.isGroup;
  const isChannel = chatInfo?.participant?.isChannel;

  useEffect(() => {
    if (!isSavedChat && messages.length > 0) {
      const confirmedMsgs = messages.filter(m => !m.isSending);
      localStorage.setItem('mesbook_messages_cache_' + currentUserId + '_' + chatId, JSON.stringify(confirmedMsgs));
    }
  }, [messages, chatId, currentUserId, isSavedChat]);

  useEffect(() => {
    if (!isGroup && !isChannel && !isGroupOrChannel) return;
    const checkMembership = async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}/is_member`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) { const data = await res.json(); setIsMember(data.isMember); }
      } catch(e) {}
    };
    checkMembership();
  }, [chatId, isGroup, isChannel, isGroupOrChannel, currentUserId]);

  const loadData = async () => {
    if (isSavedChat) return;
    if (!readFailed) {
      try {
        const res = await fetch('/api/chats/' + chatId + '/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.status === 404) setReadFailed(true);
      } catch (e) {}
    }
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
        setMessages((prev: any) => {
          const sendingMsgs = prev.filter((m: any) => m.isSending);
          const serverMsgs = Array.isArray(data) ? data : [];
          const filteredSending = sendingMsgs.filter((sm: any) => !serverMsgs.find((dm: any) => dm.content === sm.content));
          return [...serverMsgs, ...filteredSending].sort((a: any, b: any) => a.id - b.id);
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadData();
    if (!isSavedChat) {
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
    }
  }, [chatId]);

  useEffect(() => {
    const sendPing = async () => {
      if (isSavedChat || isGroupOrChannel) return;
      try { await fetch('/api/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    if (scrollRef.current && !hasScrolledToBottom.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      hasScrolledToBottom.current = true;
    }
  }, [messages]);

  const forceScrollToBottom = () => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 10); };

  const sendMessageToServer = async (text: string) => {
    const tempMsg = { id: Date.now(), content: text, isSending: !isSavedChat, senderId: currentUserId, createdAt: new Date().toISOString() };
    if (isSavedChat) {
      setMessages((prev: any) => {
        const updated = [...prev, { ...tempMsg, isSending: false }];
        localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(updated));
        return updated;
      });
      forceScrollToBottom();
      return;
    }
    setMessages((prev: any) => [...prev, tempMsg]);
    forceScrollToBottom();
    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, body: JSON.stringify({ content: text })
      });
      if (res.ok) loadData(); else setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id));
    } catch (error) { setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id)); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const tempContent = content.trim();
    const finalContent = replyingTo ? `> ${replyingTo.content}\n\n${tempContent}` : tempContent;
    setContent('');
    setReplyingTo(null);
    await sendMessageToServer(finalContent);
  };

  const joinChat = async () => {
    try {
      await fetch(`/api/chats/${chatId}/join`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } });
      setIsMember(true); loadData();
    } catch (e) {}
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
      if (data.secure_url) { await sendMessageToServer(`[MEDIA] ${data.secure_url}`); } else { alert("Ошибка при загрузке"); }
    } catch (err: any) { alert("Ошибка при загрузке"); } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (msgId: number) => {
    if (!window.confirm("Удалить сообщение?")) return;
    if (isSavedChat) {
      const updated = messages.filter((m: any) => m.id !== msgId);
      setMessages(updated);
      localStorage.setItem('mesbook_saved_messages_' + currentUserId, JSON.stringify(updated));
      return;
    }
    try { await fetch('/api/chats/' + chatId + '/messages/' + msgId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId } }); loadData(); } catch (e) {}
  };

  const lastSeen = chatInfo?.participant?.lastSeen;
  const isOnline = lastSeen ? (Date.now() - lastSeen < 3 * 60 * 1000) : false;
  const subtitleText = isSavedChat ? "" : isGroupOrChannel ? "Канал/Группа" : (isOnline ? "В сети" : (lastSeen ? `Был(а) в ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Недавно"));

  const renderMessageContent = (msgContent: string, isMe: boolean) => {
    if (msgContent.startsWith('[MEDIA] ')) {
      let url = msgContent.replace('[MEDIA] ', '').trim();
      const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/');
      if (!isVideo && url.match(/\.(heic|heif)$/i)) url = url.replace(/\.(heic|heif)$/i, '.jpg');
      return (
        <div className="mt-0.5 mb-0.5">
          {isVideo ? <video src={url} controls className="w-full max-w-[220px] rounded-[16px] bg-black/10" /> : <img src={url} alt="Media" className="w-full max-w-[220px] rounded-[16px] object-cover" />}
        </div>
      );
    }
    if (msgContent.startsWith('> ')) {
      return (
        <div className="mb-1.5">
          <div className={'pl-2 border-l-[3px] text-[11px] opacity-70 mb-1 ' + (isMe ? 'border-white/40 dark:border-black/40' : 'border-black/30 dark:border-white/30')}>
            {msgContent.split('\n\n')[0].replace('> ', '')}
          </div>
          <p className="text-[15px] leading-snug break-words">{msgContent.split('\n\n').slice(1).join('\n\n')}</p>
        </div>
      );
    }
    return <p className="text-[15px] leading-[1.3] break-words">{msgContent}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative font-sans">
      
      {/* ---------------------------------------------------------
          ПОЛНОЭКРАННЫЙ ПРОФИЛЬ ДРУГА / КАНАЛА
      --------------------------------------------------------- */}
      {showProfile && chatInfo?.participant && (
        <div className="fixed inset-0 z-50 bg-[#f2f2f7] dark:bg-black flex flex-col animate-in slide-in-from-bottom duration-200 overflow-y-auto">
          <header className="flex items-center gap-6 px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10">
            <button onClick={() => setShowProfile(false)} className="text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
            <h1 className="text-[20px] font-semibold text-black dark:text-white">Информация</h1>
          </header>
          
          <div className="flex flex-col items-center pt-8 pb-4">
            <div className="w-[120px] h-[120px] rounded-full shadow-md bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-800 mb-4">
              {chatInfo.participant.avatarUrl && chatInfo.participant.avatarUrl.length > 5 ? (
                <img src={chatInfo.participant.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[40px] font-medium text-black dark:text-white">{chatInfo.participant.displayName?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h2 className="text-[22px] font-bold text-black dark:text-white mb-1">{chatInfo.participant.displayName}</h2>
            {chatInfo.participant.username && <p className="text-[15px] text-gray-500">{chatInfo.participant.username}</p>}
            <p className={`mt-1.5 text-[13px] font-medium ${isOnline && !isGroupOrChannel ? 'text-green-500' : 'text-gray-400'}`}>{subtitleText}</p>
          </div>
          
          <div className="px-4 pb-12 w-full max-w-lg mx-auto flex flex-col gap-4">
            {chatInfo.participant.bio && (
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm p-5 border border-gray-100 dark:border-zinc-800/50">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">О себе</p>
                <p className="text-[16px] text-black dark:text-white leading-relaxed">{chatInfo.participant.bio}</p>
              </div>
            )}
            {(chatInfo.participant.personalChannel || chatInfo.participant.birthDate) && (
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm overflow-hidden border border-gray-100 dark:border-zinc-800/50">
                {chatInfo.participant.personalChannel && (
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-900/60 flex items-center gap-4">
                    <Volume2 size={22} className="text-gray-400" />
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Канал</p>
                      <p className="text-[16px] text-black dark:text-white">{chatInfo.participant.personalChannel}</p>
                    </div>
                  </div>
                )}
                {chatInfo.participant.birthDate && (
                  <div className="px-5 py-4 flex items-center gap-4">
                    <Calendar size={22} className="text-gray-400" />
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">День рождения</p>
                      <p className="text-[16px] text-black dark:text-white">{new Date(chatInfo.participant.birthDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          ШАПКА ЧАТА
      --------------------------------------------------------- */}
      <header className="px-3 pt-10 pb-3 border-b border-gray-200/50 dark:border-zinc-900/50 flex items-center gap-3 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md relative z-10 shadow-sm">
        <Link href="/"><a className="p-2 text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a></Link>
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => !isSavedChat && setShowProfile(true)}>
          <div className="relative">
            <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center font-medium text-[19px] overflow-hidden border border-gray-200/50 dark:border-zinc-700/50 ${isSavedChat ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-zinc-800 text-black dark:text-white'}`}>
              {isSavedChat ? <Bookmark size={20} fill="currentColor" /> : chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? <img src={chatInfo?.participant?.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayName.charAt(0).toUpperCase()}
            </div>
            {!isSavedChat && !isGroupOrChannel && isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1c1c1e] rounded-full"></div>}
          </div>
          <div className="flex flex-col">
            <h2 className="font-semibold text-black dark:text-white text-[16px] leading-tight">{displayName}</h2>
            {subtitleText && <p className={`text-[12px] font-medium mt-0.5 ${isGroupOrChannel ? 'text-gray-500' : (isOnline ? 'text-green-500' : 'text-gray-400')}`}>{subtitleText}</p>}
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg: any) => {
          const isMe = String(msg.senderId) === String(currentUserId);
          const isMedia = msg.content.startsWith('[MEDIA] ');
          return (
            <div key={msg.id} className={'flex flex-col max-w-[80%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')} onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchStartRef.current !== null) { const touchEndX = e.changedTouches[0].clientX; const diff = touchStartRef.current - touchEndX; if (diff > 50) { setReplyingTo(msg); if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40); } touchStartRef.current = null; } }}>
              
              <div className={(isMedia ? 'p-1 ' : 'px-4 pt-3 pb-6 pr-14 ') + 'shadow-sm relative min-w-[85px] rounded-[20px] ' + (isMe ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-sm' : 'bg-white dark:bg-[#1c1c1e] text-black dark:text-white rounded-tl-sm border border-gray-100/50 dark:border-zinc-800')}>
                
                {renderMessageContent(msg.content, isMe)}
                
                {/* БЛОК С ГАЛОЧКАМИ И ВРЕМЕНЕМ */}
                <div className={`absolute flex items-center justify-end gap-1 text-[10px] font-medium ${isMedia ? 'bottom-2.5 right-2.5 bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm' : 'bottom-1.5 right-3'} ${isMe && !isMedia ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-400 dark:text-zinc-500'}`}>
                  <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  
                  {isMe && (
                    <div className="flex items-center ml-0.5">
                      {isSavedChat || isGroupOrChannel ? (
                        <div className="flex -space-x-1"><Check size={12} strokeWidth={2.5} /><Check size={12} strokeWidth={2.5} /></div>
                      ) : msg.isSending ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <div className="flex -space-x-1">
                          <Check size={12} strokeWidth={2.5} />
                          {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && <Check size={12} strokeWidth={2.5} />}
                        </div>
                      )}
                      {!msg.isSending && (
                        <button onClick={() => handleDelete(msg.id)} className="hover:text-red-500 ml-1.5 transition-colors"><Trash2 size={11} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <div className="p-3 bg-[#f2f2f7] dark:bg-black border-t border-gray-200/50 dark:border-zinc-900/50 pb-6 relative z-10 flex flex-col">
        {replyingTo && (
          <div className="flex items-center justify-between mb-2 mx-1 px-4 py-2.5 bg-white dark:bg-[#1c1c1e] rounded-[16px] border-l-[3px] border-black dark:border-white shadow-sm">
            <div className="flex flex-col overflow-hidden mr-4">
              <span className="text-[11px] font-bold text-black dark:text-white uppercase tracking-wider mb-0.5">Ответ</span>
              <span className="text-[13px] text-gray-500 dark:text-zinc-400 truncate">{replyingTo.content.startsWith('[MEDIA]') ? 'Вложение' : replyingTo.content.replace(/^> .*\n\n/, '')}</span>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-black dark:hover:text-white rounded-full transition-colors"><X size={18} /></button>
          </div>
        )}

        {!isMember ? (
          <div className="flex items-center justify-center pt-1 px-1">
            <button onClick={joinChat} className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-[20px] shadow-sm transition-transform active:scale-95 text-[16px]">
              {isChannel ? 'Подписаться' : 'Вступить в группу'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2 px-1">
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-10 h-10 shrink-0 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50">
              {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={24} />}
            </button>
            <input className="flex-1 bg-white dark:bg-[#1c1c1e] border border-gray-200/50 dark:border-zinc-800 rounded-full px-5 py-2.5 outline-none text-black dark:text-white placeholder-gray-400 text-[16px] shadow-sm transition-colors focus:border-gray-300 dark:focus:border-zinc-600" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Сообщение" />
            <button type="submit" disabled={!content.trim()} className="w-[42px] h-[42px] flex-shrink-0 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-30 transition-transform active:scale-95 shadow-sm"><Send size={18} className="ml-1 pl-0.5" /></button>
          </form>
        )}
      </div>
    </div>
  );
}
