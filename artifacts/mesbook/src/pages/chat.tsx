import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check, X } from 'lucide-react';

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
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(() => {
  try {
    const savedChats = JSON.parse(localStorage.getItem('mesbook_chats') || '[]');
    return savedChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId)) || null;
  } catch(e) { return null; }
});
  const [content, setContent] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // --- НОВОЕ СОСТОЯНИЕ ДЛЯ ОТВЕТА НА СООБЩЕНИЕ ---
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const touchStartRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = getUserId();

  const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('chat_name_' + chatId) : null;
  const displayName = chatInfo?.participant?.displayName || chatInfo?.participant?.name || savedName || 'Собеседник';

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
        const allChats = await infoRes.json();
        const arr = Array.isArray(allChats) ? allChats : (allChats.chats || allChats.data || []);
        const currentChat = arr.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId));
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
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
      } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const tempContent = content.trim();
    // Если есть ответ, формируем текст красиво
    const finalContent = replyingTo ? `> ${replyingTo.content}\n\n${tempContent}` : tempContent;

    const tempMsg = {
      id: Date.now(),
      content: finalContent,
      isSending: true,
      senderId: currentUserId,
      createdAt: new Date().toISOString()
    };

    setMessages((prev: any) => [...prev, tempMsg]);
    setContent('');
    setReplyingTo(null); // Сбрасываем плашку ответа после отправки

    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify({ content: finalContent })
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
  const lastSeenText = isOnline ? "В сети" : (lastSeen ? `Был(а) в ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Недавно");

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
          onClick={() => setShowProfile(true)}
        >
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white font-semibold text-lg overflow-hidden">
              {chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? (
                <img src={chatInfo?.participant?.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-black dark:text-white text-base leading-tight">
              {displayName}
            </h2>
            <p className={`text-[13px] font-medium mt-0.5 ${isOnline ? 'text-green-500' : 'text-gray-400 dark:text-zinc-500'}`}>
              {lastSeenText}
            </p>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const isMe = String(msg.senderId || msg.authorId || msg.userId) === String(currentUserId);
          return (
            <div 
              key={msg.id} 
              className={'flex flex-col max-w-[85%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')}
              // --- ОТСЛЕЖИВАНИЕ СВАЙПА ---
              onTouchStart={(e) => {
                touchStartRef.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartRef.current !== null) {
                  const touchEndX = e.changedTouches[0].clientX;
                  const diff = touchStartRef.current - touchEndX;
                  
                  // Если палец сдвинулся ВЛЕВО более чем на 50 пикселей
                  if (diff > 50) {
                    setReplyingTo(msg);
                    // Микро-вибрация при успешном свайпе (работает на большинстве смартфонов)
                    if (window.navigator && window.navigator.vibrate) {
                      window.navigator.vibrate(40);
                    }
                  }
                  touchStartRef.current = null;
                }
              }}
            >
              <div className={'px-4 pt-2.5 pb-6 shadow-none relative min-w-[90px] rounded-2xl ' + (isMe ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-none' : 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-tl-none')}>
                {/* Если сообщение содержит цитату (ответ), рендерим её красиво */}
                {msg.content.startsWith('> ') ? (
                  <div className="mb-2">
                    <div className={'pl-2 border-l-2 text-[12px] opacity-70 mb-1 ' + (isMe ? 'border-white/30 dark:border-black/30' : 'border-black/20 dark:border-white/20')}>
                      {msg.content.split('\n\n')[0].replace('> ', '')}
                    </div>
                    <p className="text-[15px] leading-relaxed break-words">{msg.content.split('\n\n').slice(1).join('\n\n')}</p>
                  </div>
                ) : (
                  <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                )}
                
                <div className={'absolute bottom-1.5 right-3 flex items-center justify-end gap-1 mt-1 text-[10px] ' + (isMe ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>
                  <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  
                  {isMe && (
                    <div className="flex items-center ml-0.5">
                      {msg.isSending ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <div className="flex -space-x-1">
                          <Check size={12} />
                          {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && (
                            <Check size={12} />
                          )}
                        </div>
                      )}
                      {!msg.isSending && (
                        <button onClick={() => handleDelete(msg.id)} className="hover:text-red-500 ml-1.5 transition-colors">
                          <Trash2 size={11} />
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
        
        {/* --- ПЛАШКА ОТВЕТА --- */}
        {replyingTo && (
          <div className="flex items-center justify-between mb-3 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-2xl border-l-2 border-black dark:border-white animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex flex-col overflow-hidden mr-4">
              <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-wider mb-0.5">
                Ответ
              </span>
              <span className="text-[13px] text-gray-500 dark:text-zinc-400 truncate">
                {replyingTo.content.replace(/^> .*\n\n/, '')} {/* Убираем цитату, если отвечаем на ответ */}
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

        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            className="flex-1 bg-gray-100 dark:bg-zinc-900 border-none rounded-full px-5 py-3.5 outline-none text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Сообщение..."
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="w-12 h-12 flex-shrink-0 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-40 transition-all active:scale-95"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>

      {showProfile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-black rounded-full text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="p-8 flex flex-col items-center">
              <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-black flex items-center justify-center text-black dark:text-white text-4xl font-semibold mb-4 overflow-hidden border-4 border-white dark:border-zinc-800 shadow-sm">
                {chatInfo?.participant?.avatarUrl && chatInfo?.participant?.avatarUrl.length > 5 ? (
                  <img src={chatInfo?.participant?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-black dark:text-white text-center">{displayName}</h2>
              
              {chatInfo?.participant?.username && (
                <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">{chatInfo?.participant?.username}</p>
              )}
              
              <div className={`mt-3 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide ${isOnline ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-black text-gray-500 dark:text-zinc-400'}`}>
                {lastSeenText}
              </div>

              {chatInfo?.participant?.bio && (
                <div className="mt-8 w-full text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 tracking-wider">О себе</p>
                  <p className="text-black dark:text-white text-sm bg-gray-50 dark:bg-black rounded-2xl p-4 leading-relaxed">
                    {chatInfo?.participant?.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
