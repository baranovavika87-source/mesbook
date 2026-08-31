import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, MessageSquare, User, Plus, Moon, Sun, Users, Bookmark, Settings, UserPlus, Volume2, Check, X, Loader2, ArrowLeft, Camera } from 'lucide-react';

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
  const currentUserId = getUserId();
  
  const [chats, setChats] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mesbook_chats_' + currentUserId);
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<'chats' | 'channels'>('chats');
  
  const [modalType, setModalType] = useState<'group' | 'channel' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('mesbook_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });

  const [accounts, setAccounts] = useState<any[]>(() => {
    try {
      const accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
      const unique = Array.from(new Map(accs.map((a: any) => [String(a.id), a])).values());
      localStorage.setItem('mesbook_accounts', JSON.stringify(unique));
      return unique;
    } catch(e) { return []; }
  });

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const [savedMessages, setSavedMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mesbook_saved_messages_' + currentUserId);
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
        const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user);
          setAccounts(prev => {
            const newAccs = [...prev.filter(a => String(a.id) !== String(user.id)), user];
            localStorage.setItem('mesbook_accounts', JSON.stringify(newAccs));
            return newAccs;
          });
        }
      } catch (e) {}
    };
    fetchMe();
  }, [currentUserId]);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const res = await fetch('/api/chats', { headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          setChats(data);
          localStorage.setItem('mesbook_chats_' + currentUserId, JSON.stringify(data));
        }
      } catch (e) {}

      try {
        const saved = localStorage.getItem('mesbook_saved_messages_' + currentUserId);
        if (saved) setSavedMessages(JSON.parse(saved));
      } catch(e) {}
    };
    loadChats();
    const interval = setInterval(loadChats, 3000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/users/search?q=' + encodeURIComponent(search), { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) setSearchResults(Array.isArray(await res.json()) ? await res.json() : []);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search, currentUserId]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 70) setIsSidebarOpen(true);
    touchStartX.current = null;
  };

  const filteredChats = Array.isArray(chats) ? chats.filter((c: any) => 
    (c.participant?.displayName || '').toLowerCase().includes(search.toLowerCase())
  ) : [];

  const searchUsersGlobal = searchResults.filter(u => !u.isGroup && !u.isChannel);
  const searchChannelsGlobal = searchResults.filter(u => u.isGroup || u.isChannel);
  const localChatsFiltered = filteredChats.filter(c => !c.participant?.isGroup && !c.participant?.isChannel);
  const localChannelsFiltered = filteredChats.filter(c => c.participant?.isGroup || c.participant?.isChannel);

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

  const handleCreateGroupOrChannel = async () => {
    const name = modalType === 'group' ? groupName.trim() : channelName.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/chats/create', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + currentUserId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isGroup: modalType === 'group', isChannel: modalType === 'channel' })
      });
      if (res.ok) {
        const data = await res.json();
        setLocation('/chat/' + data.id);
      }
    } catch (e) {}

    setGroupName('');
    setChannelName('');
    setChannelDesc('');
    setModalType(null);
    setIsSidebarOpen(false);
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    if (!isLoginMode && !newName.trim()) return;
    
    setIsAddingAccount(true);
    try {
      const url = isLoginMode ? '/api/login' : '/api/register';
      const body = isLoginMode 
        ? { username: newUsername, password: newPassword } 
        : { username: newUsername, password: newPassword, displayName: newName };
        
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const user = await res.json();
        const prevAccounts = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
        const updatedAccounts = [...prevAccounts.filter((a: any) => String(a.id) !== String(user.id)), user];
        
        localStorage.setItem('mesbook_accounts', JSON.stringify(updatedAccounts));
        localStorage.setItem('mesbook_user', JSON.stringify(user));
        
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        setShowAddAccountModal(false);
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при входе");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
    setIsAddingAccount(false);
  };

  const switchAccount = (acc: any) => {
    localStorage.setItem('mesbook_user', JSON.stringify(acc));
    window.location.reload();
  };

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (String(a.id) === String(currentUser?.id)) return -1;
    if (String(b.id) === String(currentUser?.id)) return 1;
    return 0;
  });

  const lastSavedMsg = savedMessages[savedMessages.length - 1];

  const renderChatCard = (chat: any) => {
    const participant = chat.participant || {};
    const isOnline = participant.lastSeen ? (Date.now() - participant.lastSeen < 3 * 60 * 1000) : false;

    return (
      <Link key={'/chat/' + chat.id} href={'/chat/' + chat.id}>
        <a className="flex items-center px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50 last:border-0 bg-white dark:bg-[#1c1c1e]">
          <div className="w-[52px] h-[52px] shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center relative shadow-sm">
            {participant.avatarUrl && participant.avatarUrl.length > 5 ? (
              <img src={participant.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-[20px] font-medium text-black dark:text-white">{participant.displayName?.charAt(0) || "U"}</span>
            )}
            {isOnline && !participant.isGroup && !participant.isChannel && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1c1c1e] rounded-full"></div>
            )}
          </div>
          <div className="ml-4 flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline mb-0.5">
              <h3 className="font-semibold text-black dark:text-white text-[16px] truncate pr-2">
                {participant.displayName || 'Собеседник'}
              </h3>
              {chat.lastMessageTime && (
                <span className="text-[12px] text-gray-400 dark:text-zinc-500 shrink-0 font-medium">
                  {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[15px] text-gray-500 dark:text-zinc-400 truncate pr-2">
                {chat.lastMessage?.startsWith('[MEDIA]') ? 'Вложение' : (chat.lastMessage || 'Нет сообщений')}
              </p>
              {chat.lastMessage && (
                <div className="flex -space-x-1 shrink-0 text-blue-500">
                  <Check size={14} />
                  {(chat.isRead || chat.readAt || chat.status === 'read' || String(chat.id).startsWith('group_') || String(chat.id).startsWith('channel_') || String(chat.id).startsWith('custom_') || participant.isGroup || participant.isChannel) && <Check size={14} />}
                </div>
              )}
            </div>
          </div>
        </a>
      </Link>
    );
  };

  const renderGlobalUserCard = (user: any) => (
    <Link key={user.id} href={'/chat/' + user.id}>
      <a 
        onClick={() => sessionStorage.setItem('chat_name_' + user.id, user.displayName)}
        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50 last:border-0 bg-white dark:bg-[#1c1c1e]"
      >
        <div className="flex items-center gap-4">
          <div className="w-[52px] h-[52px] rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shadow-sm">
            {user.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-black dark:text-white font-medium text-[20px]">{user.displayName?.charAt(0) || "U"}</span>
            )}
          </div>
          <span className="font-semibold text-black dark:text-white text-[16px]">{user.displayName}</span>
        </div>
      </a>
    </Link>
  );

  return (
    <div 
      className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative overflow-hidden font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      
      {/* ---------------------------------------------------------
          САЙДБАР
      --------------------------------------------------------- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-[#f2f2f7] dark:bg-black z-50 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 pb-4 flex justify-between items-start relative bg-white dark:bg-[#1c1c1e] shadow-sm">
          <div className="flex flex-col">
            <div className="w-[60px] h-[60px] bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-[22px] font-bold text-black dark:text-white mb-3 overflow-hidden shadow-sm">
              {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <h2 className="text-[17px] font-semibold text-black dark:text-white leading-tight">
              {currentUser?.displayName || 'Игорь'}
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-0.5">
              {currentUser?.username || '@игорь'}
            </p>
          </div>

          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white transition-colors active:scale-95"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="flex flex-col py-3 overflow-y-auto flex-1 gap-4 px-3">
          
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm">
            {sortedAccounts.length > 1 && (
              <div className="flex flex-col">
                {sortedAccounts.map(acc => {
                  const isActive = String(acc.id) === String(currentUser?.id);
                  return (
                    <button 
                      key={acc.id} 
                      onClick={() => !isActive && switchAccount(acc)} 
                      className={`flex items-center gap-3 px-4 py-3 transition-colors w-full text-left border-b border-gray-100/50 dark:border-zinc-800/50 last:border-0 ${isActive ? 'cursor-default' : 'active:bg-gray-50 dark:active:bg-zinc-800'}`}
                    >
                      <div className="w-8 h-8 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-black dark:text-white font-medium text-xs">
                        {acc.avatarUrl && acc.avatarUrl.length > 5 ? <img src={acc.avatarUrl} className="w-full h-full object-cover" /> : acc.displayName?.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[15px] font-medium flex-1 truncate ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-zinc-400'}`}>
                        {acc.displayName}
                      </span>
                      {isActive && <Check size={18} className="text-blue-500" />}
                    </button>
                  );
                })}
              </div>
            )}
            <button 
              onClick={() => setShowAddAccountModal(true)} 
              className="flex items-center gap-4 px-4 py-3 text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors w-full text-left"
            >
              <UserPlus size={20} className="text-gray-400 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Добавить аккаунт</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <button 
              onClick={() => setModalType('group')} 
              className="flex items-center gap-4 px-4 py-3 text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors w-full text-left border-b border-gray-100/50 dark:border-zinc-800/50"
            >
              <Users size={20} className="text-gray-400 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Создать группу</span>
            </button>
            <button 
              onClick={() => setModalType('channel')} 
              className="flex items-center gap-4 px-4 py-3 text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors w-full text-left"
            >
              <Volume2 size={20} className="text-gray-400 dark:text-zinc-400" />
              <span className="text-[15px] font-medium">Создать канал</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <Link href="/chat/saved">
              <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50">
                <Bookmark size={20} className="text-gray-400 dark:text-zinc-400" />
                <span className="text-[15px] font-medium">Избранное</span>
              </a>
            </Link>
            <Link href="/settings">
              <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors">
                <Settings size={20} className="text-gray-400 dark:text-zinc-400" />
                <span className="text-[15px] font-medium">Настройки</span>
              </a>
            </Link>
          </div>

        </div>
      </div>

      {/* ---------------------------------------------------------
          МОДАЛКИ СОЗДАНИЯ
      --------------------------------------------------------- */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-[#f2f2f7] dark:bg-black flex flex-col animate-in slide-in-from-right duration-200">
          <header className="flex items-center justify-between px-4 pt-10 pb-4 bg-white dark:bg-[#1c1c1e] shadow-sm">
            <div className="flex items-center gap-6">
              <button onClick={() => setModalType(null)} className="text-black dark:text-white transition-colors">
                <ArrowLeft size={26} strokeWidth={2} />
              </button>
              <h2 className="text-[20px] font-semibold text-black dark:text-white">
                {modalType === 'group' ? 'Создать группу' : 'Создать канал'}
              </h2>
            </div>
            <button 
              onClick={handleCreateGroupOrChannel} 
              disabled={modalType === 'group' ? !groupName.trim() : !channelName.trim()} 
              className="p-1 text-black dark:text-white disabled:opacity-30 transition-opacity"
            >
              <Check size={26} strokeWidth={2.5} />
            </button>
          </header>

          <div className="mt-6 px-4">
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-[60px] h-[60px] rounded-full bg-[#f2f2f7] dark:bg-black flex items-center justify-center shrink-0">
                <Camera size={28} className="text-gray-400 dark:text-zinc-500" />
              </div>
              <div className="flex-1">
                <input
                  autoFocus
                  type="text"
                  placeholder={modalType === 'group' ? 'Название группы' : 'Название канала'}
                  value={modalType === 'group' ? groupName : channelName}
                  onChange={e => modalType === 'group' ? setGroupName(e.target.value) : setChannelName(e.target.value)}
                  className="w-full bg-transparent border-b border-gray-200 dark:border-zinc-800 py-2.5 text-[17px] text-black dark:text-white placeholder-gray-400 outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>
            </div>

            {modalType === 'channel' && (
              <div className="mt-4 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm overflow-hidden">
                <textarea 
                  rows={3}
                  value={channelDesc}
                  onChange={e => setChannelDesc(e.target.value)}
                  className="w-full bg-transparent p-4 text-[15px] text-black dark:text-white outline-none resize-none placeholder-gray-400" 
                  placeholder="Описание (необязательно)" 
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          ГЛАВНЫЙ ЭКРАН ИЛИ ПОИСК
      --------------------------------------------------------- */}
      {isSearchOpen ? (
        <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-black">
          <header className="px-4 pt-12 pb-0 bg-white dark:bg-[#1c1c1e] relative z-10 flex flex-col shadow-sm">
            <div className="flex items-center gap-4 h-10 mb-3">
              <button 
                onClick={() => { setIsSearchOpen(false); setSearch(''); }} 
                className="text-black dark:text-white"
              >
                <ArrowLeft size={24} />
              </button>
              <input
                autoFocus
                type="text"
                placeholder="Поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[18px] text-black dark:text-white placeholder-gray-400"
              />
            </div>
            <div className="flex">
              <button
                onClick={() => setSearchTab('chats')}
                className={`flex-1 pb-3 text-[15px] font-semibold transition-colors border-b-[2.5px] ${searchTab === 'chats' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 dark:text-zinc-500'}`}
              >
                Чаты
              </button>
              <button
                onClick={() => setSearchTab('channels')}
                className={`flex-1 pb-3 text-[15px] font-semibold transition-colors border-b-[2.5px] ${searchTab === 'channels' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 dark:text-zinc-500'}`}
              >
                Каналы
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pt-4 px-4 pb-20">
            {searchTab === 'chats' ? (
              <div className="flex flex-col gap-4">
                {searchUsersGlobal.length > 0 && (
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-gray-100/50 dark:border-zinc-800/50 bg-gray-50/50 dark:bg-black/20">
                      <span className="text-[13px] font-semibold text-gray-500">ГЛОБАЛЬНЫЙ ПОИСК</span>
                    </div>
                    {searchUsersGlobal.map(renderGlobalUserCard)}
                  </div>
                )}
                {localChatsFiltered.length > 0 && (
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-gray-100/50 dark:border-zinc-800/50 bg-gray-50/50 dark:bg-black/20">
                      <span className="text-[13px] font-semibold text-gray-500">ВАШИ ЧАТЫ</span>
                    </div>
                    {localChatsFiltered.map(renderChatCard)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {searchChannelsGlobal.length > 0 && (
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-gray-100/50 dark:border-zinc-800/50 bg-gray-50/50 dark:bg-black/20">
                      <span className="text-[13px] font-semibold text-gray-500">ГЛОБАЛЬНЫЙ ПОИСК</span>
                    </div>
                    {searchChannelsGlobal.map(renderGlobalUserCard)}
                  </div>
                )}
                {localChannelsFiltered.length > 0 && (
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-gray-100/50 dark:border-zinc-800/50 bg-gray-50/50 dark:bg-black/20">
                      <span className="text-[13px] font-semibold text-gray-500">ВАШИ КАНАЛЫ</span>
                    </div>
                    {localChannelsFiltered.map(renderChatCard)}
                  </div>
                )}
              </div>
            )}
            {search.length >= 2 && searchResults.length === 0 && filteredChats.length === 0 && (
               <div className="text-center py-20 text-gray-400">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p>Ничего не найдено</p>
               </div>
            )}
          </main>
        </div>
      ) : (
        <>
          <header className="px-6 pt-12 pb-4 relative z-10 bg-[#f2f2f7] dark:bg-black">
            <div className="flex justify-between items-center h-full">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-9 h-9 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden"
              >
                {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                  <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-black dark:text-white font-medium text-sm">{currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"}</span>
                )}
              </button>
              
              <h1 className="text-[20px] font-semibold text-black dark:text-white">
                Чаты
              </h1>
              
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-9 h-9 shrink-0 flex items-center justify-center text-black dark:text-white"
              >
                <Search size={22} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-sm overflow-hidden flex flex-col">
              
              <Link href="/chat/saved">
                <a className="flex items-center px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50">
                  <div className="w-[52px] h-[52px] shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm">
                    <Bookmark size={24} fill="currentColor" />
                  </div>
                  <div className="ml-4 flex-1 overflow-hidden">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-black dark:text-white text-[16px] truncate">
                        Избранное
                      </h3>
                      {savedMessages[savedMessages.length - 1]?.createdAt && (
                        <span className="text-[12px] text-gray-400 dark:text-zinc-500 shrink-0 font-medium">
                          {new Date(savedMessages[savedMessages.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] text-gray-500 dark:text-zinc-400 truncate pr-2">
                        {savedMessages.length > 0 ? (savedMessages[savedMessages.length - 1].content.startsWith('[MEDIA]') ? 'Вложение' : savedMessages[savedMessages.length - 1].content.replace(/^> .*\n\n/, '')) : 'Нет сообщений'}
                      </p>
                    </div>
                  </div>
                </a>
              </Link>

              {filteredChats.map(renderChatCard)}
              
            </div>

            {filteredChats.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                <p>Нет чатов</p>
              </div>
            )}
          </main>

          <nav className="border-t border-gray-200/50 dark:border-zinc-800/50 flex justify-around p-3 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-md z-10">
            <Link href="/">
              <a className="flex flex-col items-center text-blue-500">
                <MessageSquare size={26} className="mb-1" fill="currentColor" />
                <span className="text-[10px] font-medium">Чаты</span>
              </a>
            </Link>
            <Link href="/wall">
              <a className="flex flex-col items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Users size={26} className="mb-1" />
                <span className="text-[10px] font-medium">Стена</span>
              </a>
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}
