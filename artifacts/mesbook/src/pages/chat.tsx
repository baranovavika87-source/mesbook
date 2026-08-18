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

  const loadData = async () => {
    // 1. Попытка отметить прочитанным
    if (!readFailed) {
      try {
        const res = await fetch('/api/chats/' + chatId + '/read', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
        if (res.status === 404) setReadFailed(true);
      } catch (e) {}
    }

    // 2. Получение инфо о чате
    try {
      const infoRes = await fetch('/api/chats', {
        headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' }
      });
      if (infoRes.ok) {
        const allChats = await infoRes.json();
        const arr = Array.isArray(allChats) ? allChats : (allChats.chats || allChats.data || []);
        const currentChat = arr.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId));

        if (currentChat) {
          setChatInfo(currentChat);
        } else {
          const savedName = sessionStorage.getItem('chat_name_' + chatId);
          if (savedName) setChatInfo({ participant: { displayName: savedName } });
        }
      }
    } catch (e) {}

    // 3. Загрузка сообщений
    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(Array.isArray(data) ? data.sort((a: any, b: any) => a.id - b.id) : []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  // ВОТ ОН, ВОЗВРАЩЕННЫЙ ПИНГ
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
      id: 'temp-' + Date.now(), 
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
      <header className="px-4 pt-10 pb-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 bg-white dark:bg-gray-950 shadow-sm">
        <Link href="/"><a className="p-2 -ml-2 text-gray-500 hover:text-blue-600"><ArrowLeft size={24} /></a></Link>
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">
          {(chatInfo?.participant?.displayName || 'U').charAt(0)}
        </div>
        <h2 className="font-bold text-gray-900 dark:text-white">
          {chatInfo?.participant?.displayName || 'Собеседник'}
        </h2>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const isMe = String(msg.senderId || msg.authorId) === String(currentUserId);
          return (
            <div key={msg.id} className={'flex flex-col max-w-[80%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
              <div className={'px-4 py-2.5 rounded-2xl shadow-sm ' + (isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border text-gray-900 rounded-bl-sm')}>
                <p>{msg.content}</p>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {isMe && (
                  <div className="flex items-center">
                    {msg.isSending ? <Loader2 size={12} className="animate-spin text-blue-500" /> : (
                      <div className="flex -space-x-1">
                        <Check size={14} className="text-blue-500" />
                        {(msg.readAt || msg.isRead) && <Check size={14} className="text-blue-500" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <div className="p-4 bg-white border-t border-gray-200 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input className="flex-1 bg-gray-100 rounded-full px-5 py-3 outline-none" value={content} onChange={e => setContent(e.target.value)} placeholder="Сообщение..." />
          <button className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
