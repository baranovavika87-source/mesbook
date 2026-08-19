import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, MessageSquare, User, Settings, Plus } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // 1. Загрузка существующих чатов
  useEffect(() => {
    const loadChats = async () => {
      try {
        const res = await fetch('/api/chats', {
          headers: { 'Authorization': 'Bearer ' + getUserId(), 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          let arr = [];
          if (Array.isArray(data)) arr = data;
          else if (data && Array.isArray(data.chats)) arr = data.chats;
          else if (data && Array.isArray(data.data)) arr = data.data;
          setChats(arr);
        }
      } catch (e) {}
    };
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. Глобальный поиск пользователей
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/users/search?q=' + encodeURIComponent(search), {
          headers: { 'Authorization': 'Bearer ' + getUserId() }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredChats = Array.isArray(chats) ? chats.filter((c: any) =>
    (c.participant?.displayName || '').toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    // Главный контейнер (сделан полностью черным в dark mode)
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold text-black dark:text-white tracking-tight mb-2">Чаты</h1>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-gray-400 dark:text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Поиск или @имя..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            // Поле поиска теперь с фокусом в черно-белом стиле
            className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl pl-10 pr-4 py-3 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Результаты глобального поиска */}
        {searchResults.length > 0 && (
          <div className="px-6 py-2 border-b border-gray-100 dark:border-zinc-900">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2">Пользователи</h3>
            {searchResults.map((user: any) => (
              <Link key={user.id} href={'/chat/' + user.id}>
                <a
                  onClick={() => sessionStorage.setItem('chat_name_' + user.id, user.displayName)}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-zinc-900/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Аватар в глобальном поиске (убран синий) */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white font-semibold text-xs">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                    <span className="font-medium text-black dark:text-white text-sm">{user.displayName}</span>
                  </div>
                  {/* Иконка Plus при поиске нового человека (сделана черно/белой) */}
                  <Plus size={16} className="text-black dark:text-white" />
                </a>
              </Link>
            ))}
          </div>
        )}

        {/* Список текущих чатов */}
        <div className="divide-y divide-gray-100 dark:divide-zinc-900">
          {filteredChats.map((chat: any) => (
            <Link key={chat.id} href={'/chat/' + chat.id}>
              <a className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                {/* Аватар в списке чатов (убран синий) */}
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white font-semibold text-lg shrink-0">
                  {chat.participant?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <h3 className="font-semibold text-black dark:text-white truncate">
                    {chat.participant?.displayName || 'Собеседник'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                    {chat.lastMessage || 'Нет сообщений'}
                  </p>
                </div>
              </a>
            </Link>
          ))}

          {/* Пустое состояние */}
          {filteredChats.length === 0 && searchResults.length === 0 && (
            <div className="text-center py-20 text-gray-400 dark:text-zinc-600">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
              <p>Чатов пока нет</p>
            </div>
          )}
        </div>
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black">
        <Link href="/">
          {/* Активная вкладка - Чаты (теперь черная/белая) */}
          <a className="flex flex-col items-center text-black dark:text-white transition-colors">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <Settings size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}

