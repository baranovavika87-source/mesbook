import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, MessageSquare, User, Plus, Moon, Sun, Users, Bookmark, Settings, UserPlus, Volume2, Check, X, Loader2, ArrowLeft, Camera } from 'lucide-react';
import { io } from 'socket.io-client';

let socket: any = null;

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

const translations = {
  ru: {
    chats: "Чаты",
    wall: "Стена",
    search: "Поиск",
    globalSearch: "Глобальный поиск",
    yourChats: "Ваши чаты",
    nothingFound: "Ничего не найдено",
    startTyping: "Начните вводить имя",
    noChats: "Нет сообщений",
    addAccount: "Добавить аккаунт",
    createGroup: "Создать группу",
    createChannel: "Создать канал",
    saved: "Избранное",
    settings: "Настройки",
    loginAcc: "Войти",
    newAcc: "Новый аккаунт",
    login: "Войти",
    create: "Создать",
    namePlaceholder: "Имя (например, Игорь)",
    usernamePlaceholder: "Никнейм (@username)",
    passwordPlaceholder: "Пароль",
    continue: "Продолжить",
    groupName: "Название группы",
    channelName: "Название канала",
    description: "Описание",
    descPlaceholderGroup: "Дополнительное описание группы",
    descPlaceholderChannel: "Дополнительное описание канала",
    photo: "Фотография",
    noMessages: "Нет сообщений",
    companion: "Собеседник",
    errorLogin: "Ошибка входа",
    errorNet: "Ошибка сети",
    isTyping: "печатает...",
    areTyping: "печатают..."
  },
  en: {
    chats: "Chats",
    wall: "Wall",
    search: "Search",
    globalSearch: "Global Search",
    yourChats: "Your Chats",
    nothingFound: "Nothing found",
    startTyping: "Start typing a name",
    noChats: "No messages",
    addAccount: "Add Account",
    createGroup: "Create Group",
    createChannel: "Create Channel",
    saved: "Saved Messages",
    settings: "Settings",
    loginAcc: "Log In",
    newAcc: "New Account",
    login: "Log In",
    create: "Create",
    namePlaceholder: "Name (e.g., Igor)",
    usernamePlaceholder: "Username (@username)",
    passwordPlaceholder: "Password",
    continue: "Continue",
    groupName: "Group Name",
    channelName: "Channel Name",
    description: "Description",
    descPlaceholderGroup: "Optional group description",
    descPlaceholderChannel: "Optional channel description",
    photo: "Photo",
    noMessages: "No messages",
    companion: "Companion",
    errorLogin: "Login error",
    errorNet: "Network error",
    isTyping: "is typing...",
    areTyping: "are typing..."
  }
};

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const currentUserId = getUserId();
  
  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;
  
  const [chats, setChats] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mesbook_chats_' + currentUserId);
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [modalType, setModalType] = useState<'group' | 'channel' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [modalAvatarUrl, setModalAvatarUrl] = useState('');
  const [isUploadingModalAvatar, setIsUploadingModalAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      return saved ? JSON.parse(saved).map((m: any) => ({...m, isSending: false})) : [];
    } catch(e) { return []; }
  });
  
  const [isDark, setIsDark] = useState(false);
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const sendPing = async () => {
      try { await fetch('/api/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + currentUserId } }); } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 10000);
    return () => clearInterval(interval);
  }, [currentUserId]);

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
      if (saved) setSavedMessages(JSON.parse(saved).map((m: any) => ({...m, isSending: false})));
    } catch(e) {}
  };

  useEffect(() => {
    loadChats();
    if (!socket) socket = io(window.location.origin, { path: '/socket.io' });

    socket.on('global_update', loadChats);
    socket.on('chat_update', loadChats);
    socket.on('typing_global', loadChats);

    return () => {
      socket.off('global_update', loadChats);
      socket.off('chat_update', loadChats);
      socket.off('typing_global', loadChats);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/users/search?q=' + encodeURIComponent(search), { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        }
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

  const allDynamicChats = [...chats];
  const hasSavedInServer = allDynamicChats.some(c => String(c.id) === 'saved');
  const lastSavedMsg = savedMessages.length > 0 ? savedMessages[savedMessages.length - 1] : null;

  if (!hasSavedInServer && lastSavedMsg) {
    allDynamicChats.push({
      id: 'saved',
      participant: { id: currentUserId, displayName: t.saved, isSaved: true, avatarUrl: '' },
      lastMessage: lastSavedMsg.content,
      lastMessageAt: lastSavedMsg.createdAt,
      lastMessageSenderId: currentUserId,
      lastMessageRead: 1
    });
  } else if (hasSavedInServer && lastSavedMsg) {
    const serverSaved = allDynamicChats.find(c => String(c.id) === 'saved');
    if (serverSaved) {
      serverSaved.participant.displayName = t.saved;
      const serverTime = new Date(serverSaved.lastMessageAt || serverSaved.lastMessageTime || 0).getTime();
      const localTime = new Date(lastSavedMsg.createdAt || 0).getTime();
      if (localTime > serverTime) {
        serverSaved.lastMessage = lastSavedMsg.content;
        serverSaved.lastMessageAt = lastSavedMsg.createdAt;
        serverSaved.lastMessageSenderId = currentUserId;
        serverSaved.lastMessageRead = 1;
      }
    }
  }

  allDynamicChats.sort((a, b) => {
    const timeA = new Date(a.lastMessageAt || a.lastMessageTime || 0).getTime();
    const timeB = new Date(b.lastMessageAt || b.lastMessageTime || 0).getTime();
    return timeB - timeA;
  });

  const filteredChats = allDynamicChats.filter((c: any) => 
    (c.participant?.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

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
        body: JSON.stringify({ name, description: channelDesc, isGroup: modalType === 'group', isChannel: modalType === 'channel', avatarUrl: modalAvatarUrl })
      });
      if (res.ok) {
        const data = await res.json();
        setLocation('/chat/' + data.id);
      }
    } catch (e) {}

    setGroupName('');
    setChannelName('');
    setChannelDesc('');
    setModalAvatarUrl('');
    setModalType(null);
    setIsSidebarOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingModalAvatar(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setModalAvatarUrl(data.secure_url);
      }
    } catch (err) {}
    setIsUploadingModalAvatar(false);
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
        alert(t.errorLogin);
      }
    } catch (e) {
      alert(t.errorNet);
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

  const renderChatCard = (chat: any) => {
    const participant = chat.participant || {};
    const isSaved = participant.isSaved || String(chat.id) === 'saved';
    const isOnline = participant.lastSeen ? (Date.now() - participant.lastSeen < 15000) : false;
    const timeRaw = chat.lastMessageAt || chat.lastMessageTime;
    
    const isLastMessageMine = chat.lastMessageSenderId === currentUserId;
    const isLastMessageRead = chat.lastMessageRead === 1;

    const typingNames = chat.typing || [];
    const isTyping = typingNames.length > 0;
    
    let lastMessageText = chat.lastMessage?.startsWith('[MEDIA]') ? t.photo : (chat.lastMessage || t.noMessages);
    
    if (isTyping) {
       if (typingNames.length === 1) {
          lastMessageText = participant.isGroup || participant.isChannel ? `${typingNames[0]} ${t.isTyping}` : t.isTyping;
       } else {
          lastMessageText = `${typingNames.length} ${t.areTyping}`;
       }
    }

    return (
      <Link key={'/chat/' + chat.id} href={'/chat/' + chat.id}>
        <a className="flex items-center px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 bg-white dark:bg-[#222224]">
          <div className="relative w-[52px] h-[52px] shrink-0">
            <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 ${isSaved ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f]' : 'bg-[#e5e5ea] dark:bg-[#333336] text-[#1d1d1f] dark:text-[#f5f5f7]'}`}>
              {isSaved ? (
                <Bookmark size={24} fill="currentColor" />
              ) : participant.avatarUrl && participant.avatarUrl.length > 5 ? (
                <img 
                  src={participant.avatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.displayName || 'U')}&background=random&color=fff&size=120`; }} 
                />
              ) : (
                <span className="text-[20px] font-medium">{participant.displayName?.charAt(0) || "U"}</span>
              )}
            </div>
            {isOnline && !participant.isGroup && !participant.isChannel && !isSaved && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] border-2 border-white dark:border-[#222224] rounded-full z-10"></div>
            )}
          </div>
          <div className="ml-3.5 flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline mb-0.5">
              <h3 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] truncate pr-2 tracking-tight">
                {isSaved ? t.saved : (participant.displayName || t.companion)}
              </h3>
              {timeRaw && (
                <span className="text-[13px] shrink-0 font-medium text-[#86868b] dark:text-[#98989d]">
                  {new Date(timeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-[15px] truncate pr-2 ${isTyping ? 'text-[#1d1d1f] dark:text-[#f5f5f7] font-medium' : 'text-[#86868b] dark:text-[#98989d]'}`}>
                {lastMessageText}
              </p>
              {chat.lastMessage && !isTyping && (
                <div className="flex -space-x-1 shrink-0 items-center opacity-60">
                  {isSaved ? (
                    <><Check size={14} className="text-[#1d1d1f] dark:text-[#f5f5f7]" /><Check size={14} className="text-[#1d1d1f] dark:text-[#f5f5f7]" /></>
                  ) : isLastMessageMine && !participant.isChannel ? (
                    <>
                      <Check size={14} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />
                      {(isLastMessageRead || participant.isGroup) && <Check size={14} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
                    </>
                  ) : chat.unreadCount > 0 ? (
                    <div className="bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ml-1 opacity-100">
                      {chat.unreadCount}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </a>
      </Link>
    );
  };

  const renderGlobalUserCard = (user: any) => {
    const isOnline = user.lastSeen ? (Date.now() - user.lastSeen < 15000) : false;
    
    return (
      <Link key={user.id} href={'/chat/' + user.id}>
        <a 
          onClick={() => sessionStorage.setItem('chat_name_' + user.id, user.displayName)}
          className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors border-b border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-[#222224]"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative w-[52px] h-[52px] shrink-0">
              <div className="w-full h-full rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5">
                {user.avatarUrl && user.avatarUrl.length > 5 ? (
                  <img 
                    src={user.avatarUrl} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=random&color=fff&size=120`; }} 
                  />
                ) : (
                  <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[20px]">{user.displayName?.charAt(0) || "U"}</span>
                )}
              </div>
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] border-2 border-white dark:border-[#222224] rounded-full z-10"></div>
              )}
            </div>
            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] tracking-tight">{user.displayName}</span>
          </div>
        </a>
      </Link>
    );
  };

  return (
    <div 
      className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 relative overflow-hidden font-sans selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-[#f5f5f7] dark:bg-[#161618] z-50 transform transition-transform duration-300 ease-out flex flex-col border-r border-black/5 dark:border-white/5 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 pb-5 flex justify-between items-start relative bg-white dark:bg-[#222224] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border-b border-black/5 dark:border-white/5">
          <div className="flex flex-col">
            <div className="w-[64px] h-[64px] bg-[#e5e5ea] dark:bg-[#333336] rounded-full flex items-center justify-center text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3 overflow-hidden border border-black/5 dark:border-white/5">
              {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'U')}&background=random&color=fff&size=120`; }} 
                />
              ) : (
                currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <h2 className="text-[18px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight tracking-tight">
              {currentUser?.displayName || 'Игорь'}
            </h2>
            <p className="text-[14px] text-[#86868b] dark:text-[#98989d] mt-0.5">
              {currentUser?.username || '@игорь'}
            </p>
          </div>

          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-full bg-[#f5f5f7] dark:bg-[#333336] text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95 border border-black/5 dark:border-white/5"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="flex flex-col py-4 overflow-y-auto flex-1 gap-4 px-4">
          
          <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5">
            {sortedAccounts.length > 1 && (
              <div className="flex flex-col">
                {sortedAccounts.map(acc => {
                  const isActive = String(acc.id) === String(currentUser?.id);
                  return (
                    <button 
                      key={acc.id} 
                      onClick={() => !isActive && switchAccount(acc)} 
                      className={`flex items-center gap-3 px-4 py-3.5 transition-colors w-full text-left border-b border-black/5 dark:border-white/5 last:border-0 ${isActive ? 'cursor-default' : 'active:bg-black/[0.02] dark:active:bg-white/[0.02]'}`}
                    >
                      <div className="w-9 h-9 bg-[#e5e5ea] dark:bg-[#333336] rounded-full flex items-center justify-center overflow-hidden shrink-0 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[13px] border border-black/5 dark:border-white/5">
                        {acc.avatarUrl && acc.avatarUrl.length > 5 ? <img src={acc.avatarUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.displayName || 'U')}&background=random&color=fff&size=120`; }} /> : acc.displayName?.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[16px] tracking-tight flex-1 truncate ${isActive ? 'font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]' : 'font-medium text-[#86868b] dark:text-[#98989d]'}`}>
                        {acc.displayName}
                      </span>
                      {isActive && <Check size={18} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
                    </button>
                  );
                })}
              </div>
            )}
            <button 
              onClick={() => setShowAddAccountModal(true)} 
              className="flex items-center gap-3.5 px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors w-full text-left"
            >
              <UserPlus size={22} className="text-[#86868b] dark:text-[#98989d]" />
              <span className="text-[16px] font-medium tracking-tight">{t.addAccount}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col border border-black/5 dark:border-white/5">
            <button 
              onClick={() => setModalType('group')} 
              className="flex items-center gap-3.5 px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors w-full text-left border-b border-black/5 dark:border-white/5"
            >
              <Users size={22} className="text-[#86868b] dark:text-[#98989d]" />
              <span className="text-[16px] font-medium tracking-tight">{t.createGroup}</span>
            </button>
            <button 
              onClick={() => setModalType('channel')} 
              className="flex items-center gap-3.5 px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors w-full text-left"
            >
              <Volume2 size={22} className="text-[#86868b] dark:text-[#98989d]" />
              <span className="text-[16px] font-medium tracking-tight">{t.createChannel}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col border border-black/5 dark:border-white/5">
            <Link href="/chat/saved">
              <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3.5 px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors border-b border-black/5 dark:border-white/5">
                <Bookmark size={22} className="text-[#86868b] dark:text-[#98989d]" />
                <span className="text-[16px] font-medium tracking-tight">{t.saved}</span>
              </a>
            </Link>
            
            <Link href="/settings">
              <a onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3.5 px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors">
                <Settings size={22} className="text-[#86868b] dark:text-[#98989d]" />
                <span className="text-[16px] font-medium tracking-tight">{t.settings}</span>
              </a>
            </Link>
          </div>

        </div>
      </div>

      {/* Экран поиска */}
      {isSearchOpen ? (
        <div className="flex flex-col h-full bg-[#f5f5f7] dark:bg-[#161618]">
          <header className="px-4 pt-12 pb-3 bg-white/80 dark:bg-[#222224]/80 backdrop-blur-xl relative z-10 flex flex-col shadow-[0_1px_10px_rgba(0,0,0,0.02)] border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3 h-10">
              <button 
                onClick={() => { setIsSearchOpen(false); setSearch(''); }} 
                className="text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-transform p-1"
              >
                <ArrowLeft size={24} />
              </button>
              <input
                autoFocus
                type="text"
                placeholder={t.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-full px-4 py-2 outline-none text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b]"
              />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pt-4 px-4 pb-20">
            {search.length < 2 && searchResults.length === 0 && (
              <div className="text-center py-20 text-[#86868b] dark:text-[#98989d]">
                 <Search size={40} className="mx-auto mb-3 opacity-30" />
                 <p className="text-[15px]">{t.startTyping}</p>
              </div>
            )}

            {search.length >= 2 && (
              <div className="flex flex-col gap-5">
                {searchResults.length > 0 && (
                  <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_20px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden flex flex-col border border-black/5 dark:border-white/5">
                    <div className="px-5 py-2 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/50 dark:bg-black/10">
                      <span className="text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">{t.globalSearch}</span>
                    </div>
                    {searchResults.map(renderGlobalUserCard)}
                  </div>
                )}
                {filteredChats.length > 0 && (
                  <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_20px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden flex flex-col border border-black/5 dark:border-white/5">
                    <div className="px-5 py-2 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/50 dark:bg-black/10">
                      <span className="text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">{t.yourChats}</span>
                    </div>
                    {filteredChats.map(renderChatCard)}
                  </div>
                )}
                
                {searchResults.length === 0 && filteredChats.length === 0 && (
                   <div className="text-center py-20 text-[#86868b] dark:text-[#98989d]">
                      <Search size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-[15px]">{t.nothingFound}</p>
                   </div>
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        <>
          {/* Главный экран со списком чатов */}
          <header className="px-5 pt-12 pb-3 relative z-10 bg-[#f5f5f7] dark:bg-[#161618]">
            <div className="flex justify-between items-center h-full mb-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
              >
                {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'U')}&background=random&color=fff&size=120`; }} 
                  />
                ) : (
                  <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[15px]">{currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"}</span>
                )}
              </button>
              
              <h1 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                mesogram
              </h1>
              
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-transform"
              >
                <Search size={22} strokeWidth={2.5} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_20px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden flex flex-col border border-black/5 dark:border-white/5">
              {filteredChats.map(renderChatCard)}
            </div>

            {filteredChats.length === 0 && (
              <div className="text-center py-24 text-[#86868b] dark:text-[#98989d]">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-[16px] font-medium tracking-tight">{t.noChats}</p>
              </div>
            )}
          </main>

          <nav className="border-t border-black/[0.05] dark:border-white/[0.05] flex justify-around p-3 bg-white/80 dark:bg-[#222224]/80 backdrop-blur-xl z-10 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            <Link href="/">
              <a className="flex flex-col items-center text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95">
                <MessageSquare size={26} className="mb-1" fill="currentColor" strokeWidth={1.5} />
                <span className="text-[11px] font-semibold tracking-wide">{t.chats}</span>
              </a>
            </Link>
            <Link href="/wall">
              <a className="flex flex-col items-center text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors active:scale-95">
                <Users size={26} className="mb-1" strokeWidth={1.5} />
                <span className="text-[11px] font-semibold tracking-wide">{t.wall}</span>
              </a>
            </Link>
          </nav>
        </>
      )}

      {showAddAccountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#f5f5f7] dark:bg-[#161618] rounded-[24px] w-full max-w-sm p-6 shadow-2xl border border-black/5 dark:border-white/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                {isLoginMode ? t.loginAcc : t.newAcc}
              </h3>
              <button onClick={() => setShowAddAccountModal(false)} className="p-1 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex bg-[#e5e5ea] dark:bg-[#333336] rounded-[12px] p-1 mb-6">
               <button type="button" onClick={() => setIsLoginMode(true)} className={`flex-1 py-2 text-[14px] font-medium rounded-[10px] transition-colors ${isLoginMode ? 'bg-white dark:bg-[#222224] shadow-sm text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{t.login}</button>
               <button type="button" onClick={() => setIsLoginMode(false)} className={`flex-1 py-2 text-[14px] font-medium rounded-[10px] transition-colors ${!isLoginMode ? 'bg-white dark:bg-[#222224] shadow-sm text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{t.create}</button>
            </div>

            <form onSubmit={handleAddAccountSubmit} className="space-y-4">
              <div className="bg-white dark:bg-[#222224] rounded-[16px] overflow-hidden shadow-sm border border-black/5 dark:border-white/5">
                {!isLoginMode && (
                  <input type="text" placeholder={t.namePlaceholder} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-transparent border-b border-black/5 dark:border-white/5 px-4 py-3.5 text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] outline-none transition-colors" />
                )}
                <input type="text" placeholder={t.usernamePlaceholder} value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-transparent border-b border-black/5 dark:border-white/5 px-4 py-3.5 text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] outline-none transition-colors" />
                <input type="password" placeholder={t.passwordPlaceholder} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-transparent px-4 py-3.5 text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] outline-none transition-colors" />
              </div>
              <button type="submit" disabled={isAddingAccount} className="w-full py-3.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] font-semibold rounded-[16px] transition-transform active:scale-95 mt-2 flex items-center justify-center h-12 shadow-sm">
                {isAddingAccount ? <Loader2 size={18} className="animate-spin" /> : (isLoginMode ? t.login : t.continue)}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
