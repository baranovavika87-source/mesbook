import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpRight } from 'lucide-react';
import { getListChatsQueryKey, useListChats } from '@workspace/api-client-react';
import { AppShell, Avatar, LoadingList, PageIntro } from '@/components/mesbook-shell';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const chatsQuery = useListChats({ query: { queryKey: getListChatsQueryKey() } });

  const visibleChats = useMemo(() => {
    if (!Array.isArray(chatsQuery.data)) return [];
    return chatsQuery.data.filter((chat) => 
      chat.participant.displayName.toLowerCase().includes(search.toLowerCase())
    );
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
        console.error("Ошибка поиска:", e);
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
          {visibleChats.map((chat) => (
            <Link href={`/chat/${chat.id}`} key={chat.id} className="group flex items-center gap-3 rounded-2xl px-2 py-3.5 transition hover:bg-gray-50">
              <Avatar url={chat.participant.avatarUrl} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-bold">{chat.participant.displayName}</h2>
                <p className="truncate text-sm text-gray-500">{chat.lastMessage}</p>
              </div>
              <ArrowUpRight size={16} className="text-gray-400" />
            </Link>
          ))}

          {/* Глобальный поиск */}
          {search.length > 2 && searchResults.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase px-2 mb-2">Глобальный поиск</h3>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center gap-3 rounded-2xl px-2 py-3.5">
                  <Avatar url={user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">{user.displayName}</h2>
                  </div>
                  <button 
                    onClick={() => {
                        const storedUser = localStorage.getItem("mesbook_user");
                        const myId = storedUser ? JSON.parse(storedUser).id : 1;
                        const chatId = Math.min(myId, user.id) * 10000 + Math.max(myId, user.id);
                        window.location.href = `/chat/${chatId}`;
                    }}
                    className="text-blue-500 font-bold text-sm"
                  >
                    Начать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
