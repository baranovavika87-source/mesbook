import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, MessageSquare, User, Plus, Moon, Sun, Users, Bookmark, Settings, UserPlus, Volume2, Check, X } from 'lucide-react';

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
  
  const [chats, setChats] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mesbook_chats');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [modalType, setModalType] = useState<'group' | 'channel' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('mesbook_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });

  const [savedMessages, setSavedMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mesbook_saved_messages_' + getUserId());
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  const [isDark, setIsDark] = useState(false);
  const [, setLocation] = useLocation();

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

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
          let arr: any[] = [];
          if (Array.isArray(data)) arr = data;
          else if (data && Array.isArray(data.chats)) arr = data.chats;
          else if (data && Array.isArray(data.data)) arr = data.data;
          
          const localGroups = JSON.parse(localStorage.getItem('mesbook_custom_chats') || '[]');
          const combined = [...localGroups, ...arr];
          
          setChats(combined);
          localStorage.setItem('mesbook_chats', JSON.stringify(combined));
        }
      } catch (e) {}

      try {
        const saved = localStorage.getItem('mesbook_saved_messages_' + getUserId());
        if (saved) setSavedMessages(JSON.parse(saved));
      } catch(e) {}
    };
    loadChats();
    const interval = setInterval(loadChats, 3000);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 70) {
      setIsSidebarOpen(true);
    }
    touchStartX.current = null;
  };

  const filteredChats = Array.isArray(chats) ? chats.filter((c: any) => 
    (c.participant?.displayName || '').toLowerCase().includes(search.toLowerCase())
  ) : [];

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleCreateGroupOrChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const name = modalType === 'group' ? groupName.trim() : channelName.trim();
    if (!name) return;

    const newChatObj = {
      id: (modalType === 'group' ? 'group_' : 'channel_') + Date.now(),
      participant: {
        id: (modalType === 'group' ? 'group_' : 'channel_') + Date.now(),
        displayName: name,
        avatarUrl: '',
        isGroup: modalType === 'group',
        isChannel: modalType === 'channel'
      },
      lastMessage: modalType === 'group' ? 'Группа создана' : 'Канал создан',
      lastMessageTime: new Date().toISOString(),
      isRead: true
    };

    const localGroups = JSON.parse(localStorage.getItem('mesbook_custom_chats') || '[]');
    const updatedLocal = [newChatObj, ...localGroups];
    localStorage.setItem('mesbook_custom_chats', JSON.stringify(updatedLocal));

    const updatedChats = [newChatObj, ...chats];
    setChats(updatedChats);
    localStorage.setItem('mesbook_chats', JSON.stringify(updatedChats));

    setGroupName('');
    setChannelName('');
    setModalType(null);
    setIsSidebarOpen(false);

    setLocation('/chat/' + newChatObj.id);
  };

  const lastSavedMsg = savedMessages[savedMessages.length - 1];

  return (
    <div 
      className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300 relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 transition-opacity backdrop-blur-xs"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-white dark:bg-[#0a0a0a] z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 pb-4 flex justify-between items-start relative">
          <div className="flex flex-col">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-bold text-black dark:text-white mb-3 overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm">
              {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <h2 className="text-xl font-bold text-black dark:text-white leading-tight">
              {currentUser?.displayName || 'Игорь'}
            </h2>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
              {currentUser?.username || '@игорь'}
            </p>
          </div>

          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-900 text-black dark:text-white transition-colors active:scale-95"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="w-full h-[1px] bg-gray-100 dark:bg-zinc-900 my-1"></div>

        <div className="flex flex-col py-1 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-zinc-900/60">
          <button 
            onClick={() => alert("Функция добавления второго аккаунта в разработке")} 
            className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors w-full text-left"
          >
            <UserPlus size={20} className="text-gray-500 dark:text-zinc-400" />
            <span className="text-[15px] font-medium">Добавить аккаунт</span>
          </button>

          <Link href="/settings">
            <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
              <User size={20} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Мой профиль</span>
            </a>
          </Link>

          <button 
            onClick={() => setModalType('group')} 
            className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors w-full text-left"
          >
            <Users size={20} className="text-gray-500 dark:text-zinc-400" />
            <span className="text-[15px] font-medium">Создать группу</span>
          </button>

          <button 
            onClick={() => setModalType('channel')} 
            className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors w-full text-left"
          >
            <Volume2 size={20} className="text-gray-500 dark:text-zinc-400" />
            <span className="text-[15px] font-medium">Создать канал</span>
          </button>

          <Link href="/chat/saved">
            <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
              <Bookmark size={20} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Избранное</span>
            </a>
          </Link>

          <Link href="/settings">
            <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-6 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
              <Settings size={20} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Настройки</span>
            </a>
          </Link>
        </div>
      </div>

      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-black dark:text-white">
                {modalType === 'group' ? 'Новая группа' : 'Новый канал'}
              </h3>
              <button 
                onClick={() => setModalType(null)} 
                className="p-1 text-gray-400 hover:text-black dark:hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroupOrChannel} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1 ml-1 tracking-wider">
                  {modalType === 'group' ? 'Название группы' : 'Название канала'}
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder={modalType === 'group' ? 'Например: Команда разработчиков' : 'Например: Новости IT'}
                  value={modalType === 'group' ? groupName : channelName}
                  onChange={e => modalType === 'group' ? setGroupName(e.target.value) : setChannelName(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-black border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white font-medium rounded-xl transition-colors active:scale-95"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl transition-transform active:scale-95"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="px-6 pt-10 pb-4 h-24 relative z-10 bg-white dark:bg-black">
        {isSearchOpen ? (
          <div className="flex items-center gap-3 h-full animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 text-gray-400 dark:text-zinc-500" size={18} />
              <input 
                autoFocus
                type="text"
                placeholder="Поиск или @username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl pl-10 pr-4 py-3 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
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
        ) : (
          <div className="flex justify-between items-center h-full">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-12 h-12 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-700"
            >
              {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-black dark:text-white font-semibold">{currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"}</span>
              )}
            </button>
            
            <h1 className="text-3xl font-normal tracking-[0.05em] text-black dark:text-white uppercase px-2">
              Mesogram
            </h1>
            
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="w-12 h-12 shrink-0 flex items-center justify-center text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
            >
              <Search size={22} strokeWidth={2} />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {searchResults.length > 0 && (
          <div className="px-6 py-2 border-b border-gray-100 dark:border-zinc-900">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 tracking-wider">Пользователи</h3>
            {searchResults.map((user: any) => (
              <Link key={user.id} href={'/chat/' + user.id}>
                <a 
                  onClick={() => sessionStorage.setItem('chat_name_' + user.id, user.displayName)}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-zinc-900/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {user.avatarUrl && user.avatarUrl.length > 5 ? (
                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-black dark:text-white font-semibold">{user.displayName?.charAt(0) || "U"}</span>
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

        <div className="divide-y divide-gray-100 dark:divide-zinc-900/50">
          
          <Link href="/chat/saved">
            <a className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors">
              <div className="w-14 h-14 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center relative border border-blue-500/20 text-blue-500">
                <Bookmark size={24} />
              </div>
              <div className="ml-4 flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-black dark:text-white text-base truncate">
                    Избранное
                  </h3>
                  {lastSavedMsg && (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 shrink-0 ml-2">
                      {new Date(lastSavedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm text-gray-500 dark:text-zinc-400 truncate pr-2">
                    {lastSavedMsg ? (lastSavedMsg.content.startsWith('[MEDIA]') ? 'Вложение' : lastSavedMsg.content.replace(/^> .*\n\n/, '')) : 'Нет сообщений'}
                  </p>
                  {lastSavedMsg && (
                    <div className="flex -space-x-1 shrink-0 text-gray-400 dark:text-zinc-500">
                      <Check size={13} />
                      <Check size={13} />
                    </div>
                  )}
                </div>
              </div>
            </a>
          </Link>

          {filteredChats.map((chat: any) => {
            const participant = chat.participant || {};
            const isOnline = participant.lastSeen ? (Date.now() - participant.lastSeen < 3 * 60 * 1000) : false;

            return (
              <Link key={'/chat/' + chat.id} href={'/chat/' + chat.id}>
                <a className="flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <div className="w-14 h-14 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center relative border border-gray-200/50 dark:border-zinc-700/50">
                    {participant.avatarUrl && participant.avatarUrl.length > 5 ? (
                      <img src={participant.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-lg font-medium text-black dark:text-white">{participant.displayName?.charAt(0) || "U"}</span>
                    )}
                    
                    {isOnline && !participant.isGroup && !participant.isChannel && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-black dark:text-white text-base truncate">
                        {participant.displayName || 'Собеседник'}
                      </h3>
                      {chat.lastMessageTime && (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 shrink-0 ml-2">
                          {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 dark:text-zinc-400 truncate pr-2">
                        {chat.lastMessage?.startsWith('[MEDIA]') ? 'Вложение' : (chat.lastMessage || 'Нет сообщений')}
                      </p>
                      {chat.lastMessage && (
                        <div className="flex -space-x-1 shrink-0 text-gray-400 dark:text-zinc-500">
                          <Check size={13} />
                          {/* БЕЗОПАСНАЯ ПРОВЕРКА ЧЕРЕЗ String() */}
                          {(chat.isRead || chat.readAt || chat.status === 'read' || String(chat.id).startsWith('group_') || String(chat.id).startsWith('channel_') || String(chat.id).startsWith('custom_')) && <Check size={13} />}
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>

        {filteredChats.length === 0 && searchResults.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-zinc-600">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
            <p>Чатов пока нет</p>
          </div>
        )}
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
