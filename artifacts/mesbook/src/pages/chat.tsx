import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send } from 'lucide-react';
import { useListChats } from '@workspace/api-client-react';

const SafeAvatar = ({ name, url, isOnline }: { name: string, url?: string, isOnline?: boolean }) => {
  return (
    <div className="relative inline-block shrink-0">
      {url && url.length > 5 ? (
        <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold uppercase">
          {name ? name.charAt(0) : "U"}
        </div>
      )}
      {isOnline && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow-sm"></span>
      )}
    </div>
  );
};

export default function ChatPage() {
  const [, params] = useRoute('/chat/:id');
  const chatId = Number(params?.id);
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatsQuery = useListChats({ query: { refetchInterval: 4000 } });

  // Прямая загрузка сообщений с точным токеном авторизации
  const loadMessages = async () => {
    if (!chatId) return;
    const storedUser = localStorage.getItem("mesbook_user");
    const userId = storedUser ? JSON.parse(storedUser).id : 1;
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${userId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 1000);
    return () => clearInterval(interval);
  }, [chatId]);

  // Пульс онлайна
  useEffect(() => {
    const sendPing = async () => {
      const storedUser = localStorage.getItem("mesbook_user");
      if (!storedUser) return;
      const userId = JSON.parse(storedUser).id;
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${userId}` }
        });
      } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, []);

  // Автопрокрутка вниз
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    const storedUser = localStorage.getItem("mesbook_user");
    const userId = storedUser ? JSON.parse(storedUser).id : 1;

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}` 
        },
        body: JSON.stringify({ content })
      });
      
      if (res.ok) {
        setContent('');
        loadMessages();
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const chat = Array.isArray(chatsQuery.data) ? chatsQuery.data.find((c: any) => c.id === chatId) : null;
  const participant = chat?.participant;
  const isOnline = participant?.lastSeen ? (Date.now() - participant.lastSeen) < 60000 : false;
  const name = participant?.displayName || participant?.username || "тест";
  const avatar = participant?.avatarUrl || "";

  return (
    <div className="flex h-screen flex-col bg-[#faf8f6]">
      {/* Шапка */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="rounded-full p-2 text-gray-600 hover:bg-gray-100 transition">
          <ArrowLeft size={20} />
        </Link>
        <SafeAvatar name={name} url={avatar} isOnline={isOnline} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-gray-900">{name}</h2>
          <p className={`text-xs ${isOnline ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>
            {isOnline ? 'В сети' : 'Был(а) недавно'}
          </p>
        </div>
      </div>

      {/* Сообщения */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center text-[11px] font-bold tracking-widest text-gray-400 uppercase my-4">
          СЕГОДНЯ
        </div>

        {messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${msg.isMine ? 'bg-[#9c5961] text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-none'}`}>
              <p className="break-words">{msg.content}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.isMine ? 'text-white/70' : 'text-gray-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Ввод */}
      <div className="border-t border-gray-200 bg-white p-3 pb-6">
        <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 border border-gray-200">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Сообщение..."
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="rounded-full bg-[#9c5961] p-2.5 text-white disabled:opacity-40 transition active:scale-95 shadow-sm"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
