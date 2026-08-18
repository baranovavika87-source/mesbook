import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check } from 'lucide-react';

export default function ChatPage() {
  const [match, params] = useRoute("/chat/:chatId");
  const chatId = params?.chatId;
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const storedUser = localStorage.getItem("mesbook_user");
  const currentUserId = storedUser ? JSON.parse(storedUser).id : 1;

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${currentUserId}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Оставляем локальные сообщения (с флагом isSending), пока они не пришли с сервера
        setMessages(prev => {
          const sendingMsgs = prev.filter(m => m.isSending);
          const serverMsgs = data.filter((dm: any) => !sendingMsgs.find(sm => sm.content === dm.content));
          return [...serverMsgs, ...sendingMsgs].sort((a, b) => a.id - b.id);
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    const sendPing = async () => {
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentUserId}` }
        });
      } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, []);

  // Автоскролл вниз
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ОПТИМИСТИЧНАЯ ОТПРАВКА
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const tempContent = content;
    
    // 1. Мгновенно добавляем сообщение в UI
    const tempMsg = { 
      id: Date.now(), 
      content: tempContent, 
      isSending: true, // Флаг: сообщение в процессе отправки
      authorId: currentUserId,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setContent(''); // Мгновенно очищаем поле ввода

    // 2. Отправляем на сервер в фоне
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUserId}`
        },
        body: JSON.stringify({ content: tempContent })
      });
      
      if (res.ok) {
        // Убираем флаг isSending, чтобы появилась галочка
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, isSending: false } : m));
        loadMessages(); 
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id)); // Ошибка - убираем
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    }
  };

  const handleDelete = async (msgId: number) => {
    const confirmDelete = window.confirm("Точно удалить сообщение?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentUserId}` }
      });
      if (res.ok) {
        loadMessages();
      }
    } catch (error) {}
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Шапка чата */}
      <header className="px-4 pt-10 pb-4 border-b border-gray-200 dark:border-gray-800/50 flex items-center gap-3 bg-white dark:bg-gray-950 z-10 shadow-sm">
        <Link href="/">
          <a className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-full active:bg-gray-100 dark:active:bg-gray-900">
            <ArrowLeft size={24} />
          </a>
        </Link>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Диалог</h2>
        </div>
      </header>

      {/* Лента сообщений */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const isMe = String(msg.author?.id || msg.authorId) === String(currentUserId);

          return (
            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              <div 
                className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-blue-600 text-white rounded-br-sm' 
                    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                }`}
              >
                <p className="text-[15px] leading-relaxed">{msg.content}</p>
              </div>
              
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                
                {/* Иконки статуса отправки и удаления */}
                {isMe && (
                  <div className="flex items-center gap-2 ml-1">
                    {msg.isSending ? (
                      <Loader2 size={12} className="animate-spin text-blue-400" />
                    ) : (
                      <Check size={14} className="text-blue-500 dark:text-blue-400" />
                    )}
                    
                    {!msg.isSending && (
                      <button 
                        onClick={() => handleDelete(msg.id)} 
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 dark:text-gray-600 text-sm">Нет сообщений. Напишите первым!</p>
          </div>
        )}
      </main>

      {/* Панель ввода */}
      <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800/50 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Сообщение..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-full px-5 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="w-12 h-12 flex-shrink-0 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white disabled:opacity-40 transition active:scale-90 shadow-sm"
          >
            <Send size={18} className="ml-1" /> {/* ml-1 немного центрирует иконку самолетика */}
          </button>
        </form>
      </div>
    </div>
  );
}
