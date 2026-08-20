import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, MessageSquare, User, Plus, X, Moon, Sun, LogOut, Users } from 'lucide-react';

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
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDark, setIsDark] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': 'Bearer ' + getUserId() }
        });
        if (res.ok) setCurrentUser(await res.json());
      } catch (e) {}
    };
    fetchMe();
  }, []);

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

  const toggleTheme = () => {
    const isNowDark = document.documentElement.classList.toggle('dark');
    setIsDark(isNowDark);
  };

    const handleLogout = () => {
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300 relative overflow-hidden">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={'fixed top-0 left-0 h-full w-[80%] max-w-[320px] bg-white dark:bg-[#0a0a0a] z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ' + (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        
        <div className="p-4 flex justify-end">
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-black dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 transition">
            <X size={26} />
          </button>
        </div>

        <div className="px-6 pb-6 border-b border-gray-100 dark:border-zinc-900 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold text-black dark:text-white mb-4 overflow-hidden">
            {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'
            )}
          </div>
          <h2 className="text-2xl font-bold text-black dark:text-white leading-tight mb-1">
            {currentUser?.displayName || 'Пользователь'}
          </h2>
          <p className="text-gray-500 dark:text-zinc-400">
            {currentUser?.username || '@username'}
          </p>
        </div>

        <div className="flex flex-col py-4">
          <Link href="/settings">
            <a className="flex items-center gap-5 px-8 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
              <User size={24} />
              <span className="text-lg font-medium">Мой профиль</span>
            </a>
          </Link>
          <button onClick={toggleTheme} className="flex items-center gap-5 px-8 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors w-full text-left">
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
            <span className="text-lg font-medium">Тема</span>
          </button>
        </div>

        <div className="mt-auto mb-6">
          <button onClick={handleLogout} className="flex items-center gap-5 px-8 py-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left">
            <LogOut size={24} />
            <span className="text-lg font-medium">Выйти</span>
          </button>
        </div>
      </div>

      <header className="px-6 pt-10 pb-4 h-24">
        {!isSearchOpen ? (
          <div className="flex justify-between items-center h-full">
            {/* ИЗМЕНЕНА КНОПКА: ТЕПЕРЬ ТУТ АВАТАРКА */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-12 h-12 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white font-bold text-xl transition-transform active:scale-95 overflow-hidden"
            >
              {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'
              )}
            </button>
            
            <h1 className="text-3xl font-normal tracking-[0.05em] text-black dark:text-white uppercase px-2">
              Mesbook
            </h1>

            <button 
              onClick={() => setIsSearchOpen(true)}
              className="w-12 h-12 shrink-0 flex items-center justify-center text-black dark:text-white transition-transform active:scale-95"
            >
              <Search size={30} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 h-full animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 text-gray-400 dark:text-zinc-500" size={18} />
              <input
                autoFocus
                type="text"
                placeholder="Поиск или @имя..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl pl-10 pr-4 py-3 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              />
            </div>
            <button 
              onClick={() => {
                setIsSearchOpen(false);
                setSearch('');
              }}
              className="text-black dark:text-white font-medium text-sm px-2 hover:opacity-70 transition-opacity"
            >
              Отмена
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
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
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white font-semibold text-xs overflow-hidden">
                      {user.avatarUrl && user.avatarUrl.length > 5 ? (
                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        user.displayName?.charAt(0) || 'U'
                      )}
                    </div>
                    <span className="font-medium text-black dark:text-white text-sm">{user.displayName}</span>
                  </div>
                  <Plus size={16} className="text-black dark:text-white" />
                </a>
              </Link>
            ))}
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-zinc-900">
          {filteredChats.map((chat: any) => {
            const participant = chat.participant || {};
            return (
              <Link key={chat.id} href={'/chat/' + chat.id}>
                <a className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white font-semibold text-lg shrink-0 overflow-hidden">
                    {participant.avatarUrl && participant.avatarUrl.length > 5 ? (
                      <img src={participant.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      participant.displayName?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="ml-4 flex-1 overflow-hidden">
                    <h3 className="font-semibold text-black dark:text-white truncate">
                      {participant.displayName || 'Собеседник'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                      {chat.lastMessage || 'Нет сообщений'}
                    </p>
                  </div>
                </a>
              </Link>
            );
          })}

          {filteredChats.length === 0 && searchResults.length === 0 && (
            <div className="text-center py-20 text-gray-400 dark:text-zinc-600">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
              <p>Чатов пока нет</p>
            </div>
          )}
        </div>
      </main>

      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black z-10">
        <Link href="/">
          <a className="flex flex-col items-center text-black dark:text-white transition-colors">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <Users size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
