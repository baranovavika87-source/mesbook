import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpRight } from 'lucide-react';
import { getListChatsQueryKey, useListChats } from '@workspace/api-client-react';
import { AppShell, LoadingList, PageIntro } from '@/components/mesbook-shell';

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
      {/* Магия: Зеленая точка онлайна */}
      {isOnline && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow-sm"></span>
      )}
    </div>
  );
};

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Автоматически незаметно обновляем список чатов каждые 5 секунд, чтобы видеть онлайн в реальном времени
  const chatsQuery = useListChats({ 
    query: { 
      queryKey: getListChatsQueryKey(),
      refetchInterval: 5000 
    } 
  });

  // ПУЛЬС: Отправляем сигнал на сервер каждые 30 секунд
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
      } catch (e) {
        // Игнорируем ошибки сети для пульса, чтобы не мешать пользователю
      }
    };
    
    sendPing(); // Отправляем сигнал сразу при входе
    const interval = setInterval(sendPing, 30000); // И потом каждые 30 секунд
    return () => clearInterval(interval);
  }, []);

  const visibleChats = useMemo(() => {
    if (!Array.isArray(chatsQuery.data)) return [];
    return chatsQuery.data.filter((chat) => {
      const name = chat?.participant?.displayName || "";
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [chatsQuery.data, search]);

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.length > 2) {
      try {
        const storedUser = localStorage.getItem("mesbook_user");
        const userId = storedUser ? JSON.parse(storedUser).id : 1;
        
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`, {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        
        if (res.ok) {
          const users = await res.json();
          setSearchResults(Array.isArray(users) ? users : []);
        }
      } catch (e) {
        console.error("Search error:", e);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Функция проверки: человек онлайн, если он подавал сигнал меньше 60 секунд назад
  const checkIsOnline = (lastSeen: number) => {
    if (!lastSeen) return false;
    return (Date.now() - lastSeen) < 60000;
  };

  return (
    <AppShell>
      <PageIntro eyebrow="A quieter inbox" title="Chats" subtitle="Private words, kept close." />
      
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg">
          <Search size={17} className="text-gray-400" />
          <input 
            value={search} 
            onChange={(e) => handleSearch(e.target.value)} 
            placeholder="Поиск или @имя пользователя..." 
            className="w-full bg-transparent text-sm outline-none" 
          />
        </div>
      </div>

      {chatsQuery.isLoading ? <LoadingList /> : (
        <div className="px-4">
          {/* Существующие чаты */}
          {visibleChats.map((chat) => {
            const participant = chat?.participant || {};
            const name = participant.displayName || participant.display_name || participant.username || "Пользователь";
            const avatar = participant.avatarUrl || participant.avatar_url || "";
            // Проверяем онлайн
            const isOnline = checkIsOnline(participant.lastSeen || participant.last_seen);
            
            return (
              <Link href={`/chat/${chat.id}`} key={chat.id} className="group flex items-center gap-3 rounded-2xl px-2 py-3.5 transition hover:bg-gray-50">
                <SafeAvatar name={name} url={avatar} isOnline={isOnline} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{name}</h2>
                  <p className="truncate text-sm text-gray-500">{chat.lastMessage || ""}</p>
                </div>
                <ArrowUpRight size={16} className="text-gray-400" />
              </Link>
            );
          })}

          {/* Глобальный поиск */}
          {search.length > 2 && searchResults.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase px-2 mb-2">Глобальный поиск</h3>
              {searchResults.map((user) => {
                const name = user?.displayName || user?.display_name || user?.username || "Неизвестный";
                const avatar = user?.avatarUrl || user?.avatar_url || "";
                // Проверяем онлайн в поиске
                const isOnline = checkIsOnline(user?.lastSeen || user?.last_seen);
                
                return (
                  <div key={user.id} className="flex items-center gap-3 rounded-2xl px-2 py-3.5">
                    <SafeAvatar name={name} url={avatar} isOnline={isOnline} />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold">{name}</h2>
                    </div>
                    <button 
                      onClick={() => {
                          const storedUser = localStorage.getItem("mesbook_user");
                          const myId = storedUser ? JSON.parse(storedUser).id : 1;
                          const chatId = Math.min(myId, user.id) * 10000 + Math.max(myId, user.id);
                          window.location.href = `/chat/${chatId}`;
                      }}
                      className="text-blue-500 font-bold text-sm bg-blue-50 px-3 py-1 rounded-full"
                    >
                      Начать
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
