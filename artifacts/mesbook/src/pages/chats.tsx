import { useState } from 'react';
import { Link } from 'wouter';
import { Search, MessageSquare, User, Settings } from 'lucide-react';
import { useListChats } from '@workspace/api-client-react';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const chatsQuery = useListChats({ query: { refetchInterval: 5000 } });

  const chats = Array.isArray(chatsQuery.data) 
    ? chatsQuery.data.filter((c: any) => 
        c.participant?.displayName?.toLowerCase().includes(search.toLowerCase())
      ) 
    : [];

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Шапка: Крупный Apple-style заголовок */}
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">Чаты</h1>
        
        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </header>

      {/* Список чатов */}
      <main className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p>Чатов пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {chats.map((chat: any) => (
              <Link key={chat.id} href={`/chat/${chat.id}`}>
                <a className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition active:bg-blue-50">
                  {/* Аватар */}
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                    {chat.participant?.displayName?.charAt(0) || "U"}
                  </div>
                  
                  {/* Контент */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h2 className="font-semibold text-gray-900 truncate">
                        {chat.participant?.displayName || "Пользователь"}
                      </h2>
                      <span className="text-xs text-gray-400">
                        {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{chat.lastMessage || "Нет сообщений"}</p>
                  </div>

                  {/* Бедж непрочитанных (синий!) */}
                  {chat.unreadCount > 0 && (
                    <div className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {chat.unreadCount}
                    </div>
                  )}
                </a>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 flex justify-around p-4 bg-white">
        <Link href="/chats">
          <a className="flex flex-col items-center text-blue-600">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 hover:text-blue-600 transition">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-gray-400 hover:text-blue-600 transition">
            <Settings size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}

