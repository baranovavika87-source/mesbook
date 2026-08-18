import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

export default function ChatPage() {
  const [match, params] = useRoute('/chat/:chatId');
  const chatId = params?.chatId;
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [content, setContent] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = getUserId();

  // Достаем имя сразу, чтобы шапка не моргала "Пользователем"
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
        setMessages(prev => {
          // Ищем сообщения, которые еще отправляются
          const sendingMsgs = prev.filter(m => m.isSending);
          // Фильтруем ответ сервера: убираем те, текст которых совпадает с отправляемыми, чтобы избежать дублей
          const serverMsgs = Array.isArray(data) ? data : [];
          const filteredServerMsgs = serverMsgs.filter(dm => !sendingMsgs.find(sm => sm.content === dm.content));
          
          return [...filteredServerMsgs, ...sendingMsgs].sort((a: any, b: any) => a.id - b.id);
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

    const tempContent = content;
    const tempMsg = { 
      id: Date.now(), // Используем число, чтобы сортировка не ломалась
      content: tempContent, 
      isSending: true, 
      senderId: currentUserId, 
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setContent('');

    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify({ content: tempContent })
      });
      if (res.ok) {
        loadData(); 
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
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

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      
      {/* ИДЕАЛЬНАЯ ШАПКА ИЗ ПРОШЛОГО */}
      <header className="px-4 pt-10 pb-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-gray-950 shadow-sm z-10">
        <Link href="/">
          <a className="p-2 -ml-2 text-gray-500 hover:text-blue-600 dark:text-gray-400"><ArrowLeft size={24} /></a>
        </Link>
        <div className="relative">
          <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold uppercase text-lg">
            {displayName.charAt(0)}
          </div>
          {/* Зеленая точка онлайна */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-950 rounded-full"></div>
        </div>
        <div className="flex flex-col">
          <h2 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
            {displayName}
          </h2>
          <p className="text-sm text-green-500 font-medium mt-0.5">В сети</p>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const isMe = String(msg.senderId || msg.authorId || msg.userId) === String(currentUserId);
          return (
            <div key={msg.id} className={'flex flex-col max-w-[85%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
              
              {/* ИДЕАЛЬНЫЙ ДИЗАЙН СООБЩЕНИЯ (ВРЕМЯ И ГАЛОЧКИ ВНУТРИ) */}
              <div className={'px-4 py-2.5 shadow-sm relative min-w-[80px] ' + (isMe ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm')}>
                <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                
                {/* Блок с временем и галочками */}
                <div className={'flex items-center justify-end gap-1 mt-1 text-[11px] ' + (isMe ? 'text-blue-100/90' : 'text-gray-400')}>
                  <span>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  
                  {isMe && (
                    <div className="flex items-center ml-0.5">
                      {msg.isSending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <div className="flex -space-x-1">
                          <Check size={14} />
                          {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && (
                            <Check size={14} />
                          )}
                        </div>
                      )}
                      {!msg.isSending && (
                        <button onClick={() => handleDelete(msg.id)} className="hover:text-red-300 ml-1.5 transition-colors">
                          <Trash2 size={12} />
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

      <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input 
            className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-full px-5 py-3.5 outline-none text-gray-900 dark:text-white" 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            placeholder="Сообщение..." 
          />
          <button 
            type="submit" 
            disabled={!content.trim()} 
            className="w-12 h-12 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
                                      }
