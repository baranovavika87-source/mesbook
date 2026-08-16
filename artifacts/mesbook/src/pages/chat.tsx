import { useState, useEffect, useRef, useMemo } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send } from 'lucide-react';
import { useListMessages, useCreateMessage, getListChatsQueryKey, useListChats } from '@workspace/api-client-react';
import { AppShell } from '@/components/mesbook-shell';

// НАШ БРОНЕБОЙНЫЙ АВАТАР С ЗЕЛЕНОЙ ТОЧКОЙ
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Получаем сообщения (автоматически обновляются каждую секунду)
  const messagesQuery = useListMessages({
    params: { chatId },
    query: { refetchInterval: 1000 }
  });

  // Получаем данные о собеседнике (обновляем каждые 5 секунд для проверки его онлайна)
  const chatsQuery = useListChats({ 
    query: { queryKey: getListChatsQueryKey(), refetchInterval: 5000 } 
  });

  const createMessage = useCreateMessage();

  // ПУЛЬС: Отправляем сигнал на сервер даже когда мы внутри чата!
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

  // Автопрокрутка вниз при новом сообщении
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQuery.data]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    try {
      await createMessage.mutateAsync({ params: { chatId }, body: { content } });
      setContent(''); // Очищаем поле после отправки
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Ищем собеседника, чтобы нарисовать его аватарку
  const participant = useMemo(() => {
    if (!Array.isArray(chatsQuery.data)) return null;
    const chat = chatsQuery.data.find((c: any) => c.id === chatId);
    return chat?.participant;
  }, [chatsQuery.data, chatId]);

  // Проверка: онлайн ли собеседник?
  const isOnline = participant?.lastSeen ? (Date.now() - participant.lastSeen) < 60000 : false;
  const name = participant?.displayName || participant?.username || "Собеседник";
  const avatar = participant?.avatarUrl || "";

  return (
    <AppShell>
      {/* Шапка чата */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white/80 p-4 backdrop-blur-md">
        <Link href="/" className="rounded-full p-2 hover:bg-gray-100 transition">
          <ArrowLeft size={20} />
        </Link>
        <SafeAvatar name={name} url={avatar} isOnline={isOnline} />
        <div>
          <h2 className="font-bold capitalize">{name}</h2>
          <p className={`text-xs transition-colors duration-500 ${isOnline ? 'text-green-500 font-bold' : 'text-gray-400'}`}>
            {isOnline ? 'В сети' : 'Был(а) недавно'}
          </p>
        </div>
      </div>

      {/* Поле с сообщениями */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center text-xs font-bold tracking-widest text-gray-400 uppercase my-6">
          СЕГОДНЯ
        </div>
        
        {messagesQuery.data?.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-3xl px-5 py-3 shadow-sm ${msg.isMine ? 'bg-[#9c5961] text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-none'}`}>
              <p>{msg.content}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.isMine ? 'text-white/70' : 'text-gray-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Поле ввода */}
      <div className="border-t border-gray-100 bg-white p-4 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full bg-gray-50 p-2 border border-gray-200">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write something private..."
            className="flex-1 bg-transparent px-4 py-2 outline-none"
          />
          <button
            type="submit"
            disabled={!content.trim() || createMessage.isPending}
            className="rounded-full bg-[#9c5961] p-3 text-white disabled:opacity-50 transition active:scale-95 shadow-md hover:bg-opacity-90"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

