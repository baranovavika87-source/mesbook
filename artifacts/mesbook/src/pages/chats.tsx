import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, MessageSquare, User, Settings } from 'lucide-react';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const storedUser = localStorage.getItem("mesbook_user");
        const userId = storedUser ? JSON.parse(storedUser).id : 1;
        const res = await fetch('/api/chats', {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Безопасное обновление: если данные — массив, берем их, иначе пустой массив
          setChats(Array.isArray(data) ? data : []);
        }
      } catch (e) {}
    };
    loadChats();
    const interval = setInterval(loadChats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Фильтруем чаты безопасно, не ломая верстку
  const filteredChats = chats.filter((c: any) => {
    const name = c.participant?.displayName || "Собеседник";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950 transition-colors duration-300">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Чаты</h1>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-gray-400 dark:text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Поиск или @имя..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 transition outline-none"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {filteredChats.map((chat: any) => (
            <Link key={chat.id} href={`/chat/${chat.id}`}>
              <a className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition active:bg-gray-100 dark:active:bg-gray-800">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-transparent dark:border-blue-800/50">
                  {chat.participant?.displayName?.charAt(0) || "U"}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {chat.participant?.displayName || "Собеседник"}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {chat.lastMessage || "Нет сообщений"}
                  </p>
                </div>
              </a>
            </Link>
          ))}
          {filteredChats.length === 0 && (
            <div className="text-center py-20 text-gray-400 dark:text-gray-600">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
              <p>Чатов пока нет</p>
            </div>
          )}
        </div>
      </main>

      {/* Навигация */}
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
