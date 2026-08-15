import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpRight } from 'lucide-react';
import { getListChatsQueryKey, useListChats } from '@workspace/api-client-react';
// Обрати внимание: мы удалили капризный Avatar из импорта!
import { AppShell, LoadingList, PageIntro } from '@/components/mesbook-shell';

// НАШ БРОНЕБОЙНЫЙ АВАТАР (Никогда не вызовет ошибку)
const SafeAvatar = ({ name, url }: { name: string, url?: string }) => {
  if (url && url.length > 5) {
    return <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-100" />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold uppercase shrink-0">
      {name ? name.charAt(0) : "U"}
    </div>
  );
};

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const chatsQuery = useListChats({ query: { queryKey: getListChatsQueryKey() } });

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
            
            return (
              <Link href={`/chat/${chat.id}`} key={chat.id} className="group flex items-center gap-3 rounded-2xl px-2 py-3.5 transition hover:bg-gray-50">
                <SafeAvatar name={name} url={avatar} />
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
                
                return (
                  <div key={user.id} className="flex items-center gap-3 rounded-2xl px-2 py-3.5">
                    <SafeAvatar name={name} url={avatar} />
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
  
