import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check, X, Paperclip, Bookmark } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

export default function ChatPage() {
  const [match, params] = useRoute('/chat/:chatId');
  const chatId = params?.chatId;
  const isSavedChat = chatId === 'saved';

  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const touchStartRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = getUserId();
  const hasScrolledToBottom = useRef(false);

  const [chatInfo, setChatInfo] = useState<any>(() => {
    if (isSavedChat) {
      return { participant: { displayName: 'Избранное', isSaved: true } };
    }
    try {
      const savedChats = JSON.parse(localStorage.getItem('mesbook_chats') || '[]');
      return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
    } catch(e) { return null; }
  });

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = isSavedChat ? 'Избранное' : (chatInfo?.participant?.displayName || chatInfo?.name || savedName || 'Собеседник');
  const isGroup = chatInfo?.participant?.isGroup;
  const isChannel = chatInfo?.participant?.isChannel;

  const loadData = async () => {
    if (!readFailed) {
      try {
        const res = await fetch('/api/chats/' + chatId + '/read', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
        if (res.status === 404) setReadFailed(true);
      } catch (e) {}
    }

    try {
      const infoRes = await fetch('/api/chats', {
        headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' }
      });
      if (infoRes.ok) {
        const data = await infoRes.json();
        const currentChat = data.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId));
        if (currentChat) setChatInfo(currentChat);
      }
    } catch (e) {}

    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
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
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    const sendPing = async () => {
      if (isSavedChat || isGroup || isChannel) return;
      try {
        await fetch('/api/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } });
      } catch (e) {}
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

  const sendMessageToServer = async (text: string) => {
    const tempMsg = {
      id: Date.now(),
      content: text,
      isSending: true,
      senderId: currentUserId,
      createdAt: new Date().toISOString()
    };

    setMessages((prev: any) => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify({ content: text })
      });
      if (res.ok) {
        loadData();
      } else {
        setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id));
      }
    } catch (error) {
      setMessages((prev: any) => prev.filter((m: any) => m.id !== tempMsg.id));
    }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.secure_url) {
        const mediaMsg = `[MEDIA] ${data.secure_url}`;
        await sendMessageToServer(mediaMsg);
      } else {
        const errorMsg = `[MEDIA] ERROR: ${JSON.stringify(data)}`;
        await sendMessageToServer(errorMsg);
      }
    } catch (err: any) {
      alert("Ошибка при загрузке файла");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (msgId: number) => {
    if (!window.confirm("Удалить сообщение?")) return;
    try {
      await fetch('/api/chats/' + chatId + '/messages/' + msgId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      loadData();
    } catch (e) {}
  };

  const lastSeen = chatInfo?.participant?.lastSeen;
  const isOnline = lastSeen ? (Date.now() - lastSeen < 3 * 60 * 1000) : false;
  
  const subtitleText = isSavedChat 
    ? "" 
    : isGroup 
      ? "1 участник" 
      : isChannel
        ? "1 подписчик"
        : (isOnline ? "В сети" : (lastSeen ? `Был(а) в ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Недавно"));

  const renderMessageContent = (msgContent: string, isMe: boolean) => {
    if (msgContent.startsWith('[MEDIA] ')) {
      let url = msgContent.replace('[MEDIA] ', '').trim();
      const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/');
      
      if (!isVideo && url.match(/\.(heic|heif)$/i)) {
        url = url.replace(/\.(heic|heif)$/i, '.jpg');
      }
      
      return (
        <div className="mt-0.5 mb-0.5">
          {isVideo ? (
            <video src={url} controls className="w-full max-w-[180px] rounded-[4px] bg-black/10" />
          ) : (
            <img src={url} alt="Media" className="w-full max-w-[180px] rounded-[4px] object-cover" />
          )}
        </div>
      );
    }
    
    if (msgContent.startsWith('> ')) {
      return (
        <div className="mb-1.5">
          <div className={'pl-2 border-l-2 text-[11px] opacity-70 mb-1 ' + (isMe ? 'border-white/30 dark:border-black/30' : 'border-black/20 dark:border-white/20')}>
            {msgContent.split('\n\n')[0].replace('> ', '')}
          </div>
          <p className="text-[13px] leading-tight break-words">{msgContent.split('\n\n').slice(1).join('\n\n')}</p>
        </div>
      );
    }

    return <p className="text-[13px] leading-tight break-words">{msgContent}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black transition-colors duration-300 relative">
      
      <header className="px-4 pt-10 pb-4 border-b border-gray-100 dark:border-zinc-900 flex items-center gap-4 bg-white dark:bg-black relative z-10">
        <Link href="/">
          <a className="p-2 -ml-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </a>
        </Link>
        
        <div 
          className="flex items-center gap-3 cursor-pointer flex-1"
          onClick={() => !isSavedChat && !isGroup && !isChannel && setShowProfile(true)}
        >
          <div className="relative">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-lg overflow-hidden ${isSavedChat ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white'}`}>
              {isSavedChat ? (
                <Bookmark size={20} />
              ) : chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? (
                <img src={chatInfo?.participant?.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            {!isSavedChat && !isGroup && !isChannel && isOnline && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-black dark:text-white text-base leading-tight">
              {displayName}
            </h2>
            {subtitleText && (
              <p className={`text-[13px] font-medium mt-0.5 ${isGroup || isChannel ? 'text-gray-400 dark:text-zinc-500' : (isOnline ? 'text-green-500' : 'text-gray-400 dark:text-zinc-500')}`}>
                {subtitleText}
              </p>
            )}
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg: any) => {
          const isMe = String(msg.senderId || msg.authorId || msg.userId) === String(currentUserId);
          const isMedia = msg.content.startsWith('[MEDIA] ');
          
          return (
            <div 
              key={msg.id} 
              className={'flex flex-col max-w-[70%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')}
              onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchStartRef.current !== null) {
                  const touchEndX = e.changedTouches[0].clientX;
                  const diff = touchStartRef.current - touchEndX;
                  if (diff > 50) {
                    setReplyingTo(msg);
                    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
                  }
                  touchStartRef.current = null;
                }
              }}
            >
              <div className={(isMedia ? 'p-1 pb-4 ' : 'px-3 pt-2 pb-4 ') + 'shadow-none relative min-w-[65px] rounded-md ' + (isMe ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-none' : 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-tl-none')}>
                
                {renderMessageContent(msg.content, isMe)}
                
                <div className={'absolute bottom-0.5 right-1.5 flex items-center justify-end gap-1 mt-1 text-[9px] ' + (isMe ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-500')}>
                  <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  
                  {isMe && (
                    <div className="flex items-center ml-0.5">
                      {isSavedChat || isGroup || isChannel ? (
                        <div className="flex -space-x-1">
                          <Check size={11} />
                          <Check size={11} />
                        </div>
                      ) : msg.isSending ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <div className="flex -space-x-1">
                          <Check size={11} />
                          {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && (
                            <Check size={11} />
                          )}
                        </div>
                      )}
                      {!msg.isSending && (
                        <button onClick={() => handleDelete(msg.id)} className="hover:text-red-500 ml-1 transition-colors">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </main>

      <div className="p-4 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-900 pb-8 relative z-10 flex flex-col">
        
        {replyingTo && (
          <div className="flex items-center justify-between mb-3 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-md border-l-2 border-black dark:border-white animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex flex-col overflow-hidden mr-4">
              <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-wider mb-0.5">Ответ</span>
              <span className="text-[12px] text-gray-500 dark:text-zinc-400 truncate">
                {replyingTo.content.startsWith('[MEDIA]') ? 'Вложение' : replyingTo.content.replace(/^> .*\n\n/, '')}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setReplyingTo(null)} 
              className="p-1.5 flex-shrink-0 text-gray-400 hover:text-black dark:hover:text-white rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-10 h-10 shrink-0 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={22} />}
          </button>

          <input
            className="flex-1 bg-gray-100 dark:bg-zinc-900 border-none rounded-md px-4 py-3 outline-none text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all ml-1 text-[13px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Сообщение..."
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="w-11 h-11 flex-shrink-0 rounded-md bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-40 transition-all active:scale-95 ml-1"
          >
            <Send size={16} className="ml-1" />
          </button>
        </form>
      </div>

    </div>
  );
                      }
