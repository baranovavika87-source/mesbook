import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, MessageSquare, User, Settings, Plus } from 'lucide-react';
import { useListChats } from '@workspace/api-client-react';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const chatsQuery = useListChats({ query: { refetchInterval: 5000 } });

  // Живой поиск пользователей
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const storedUser = localStorage.getItem("mesbook_user");
      const userId = storedUser ? JSON.parse(storedUser).id : 1;
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        if (res.ok) setSearchResults(await res.json());
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const chats = Array.isArray(chatsQuery.data) 
    ? chatsQuery.data.filter((c: any) => 
        c.participant?.displayName?.toLowerCase().includes(search.toLowerCase())
      ) 
    : [];

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950 transition-colors duration-300">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">Чаты</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Поиск или @имя..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Результаты поиска новых пользователей */}
        {searchResults.length > 0 && (
          <div className="px-6 pb-4 border-b border-gray-100 dark:border-gray-800/50">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Найти</h3>
            {searchResults.map((user: any) => (
              <Link key={user.id} href={`/chat/${user.id * 10000 + 1}`}>
                <a className="flex items-center gap-3 py-2 text-blue-600 dark:text-blue-400 font-medium hover:opacity-80 transition">
                  <Plus size={16} /> @{user.username.replace('@', '')}
                </a>
              </Link>
            ))}
          </div>
        )}

        {/* Список существующих чатов */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {chats.map((chat: any) => (
            <Link key={chat.id} href={`/chat/${chat.id}`}>
              <a className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition active:bg-blue-50 dark:active:bg-blue-900/20">
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg border border-transparent dark:border-blue-800/50">
                  {chat.participant?.displayName?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {chat.participant?.displayName || "Пользователь"}
                    </h2>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{chat.lastMessage || "Начните чат"}</p>
                </div>
                {chat.unreadCount > 0 && (
                  <div className="bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                    {chat.unreadCount}
                  </div>
                )}
              </a>
            </Link>
          ))}
          
          {chats.length === 0 && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-600">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p>Чатов пока нет</p>
            </div>
          )}
        </div>
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 dark:border-gray-900 flex justify-around p-4 bg-white dark:bg-gray-950 transition-colors duration-300">
        <Link href="/">
          <a className="flex flex-col items-center text-blue-600 dark:text-blue-500">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <Settings size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}

