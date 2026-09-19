import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Camera, Loader2, X, Calendar, Volume2, LogOut, ChevronRight, UserCircle, MessageCircle, Globe, Check } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

// ==========================================
// СЛОВАРЬ ПЕРЕВОДОВ (СИСТЕМА ЯЗЫКОВ)
// ==========================================
const translations = {
  ru: {
    settingsTitle: "Настройки",
    profileTitle: "Профиль",
    languageTitle: "Язык",
    account: "Аккаунт",
    accountDesc: "Номер, имя пользователя, «О себе»",
    chatSettings: "Настройки чатов",
    chatSettingsDesc: "Обои, ночной режим, анимации",
    language: "Язык",
    languageCurrent: "Русский",
    logout: "Выйти из аккаунта",
    chatName: "Имя в чате",
    username: "Никнейм",
    bio: "О себе",
    bioPlaceholder: "Расскажите немного о себе...",
    channel: "Личный Канал",
    channelPlaceholder: "t.me/мойканал",
    birthday: "День рождения",
    infoVisible: "Эта информация будет видна в вашем профиле.",
    changePassword: "Изменить пароль",
    newPassword: "Новый пароль",
    saveChanges: "Сохранить изменения",
    devNotice: "В разработке",
    confirmLogout: "Выйти из аккаунта?",
    errorSave: "Ошибка сохранения",
  },
  en: {
    settingsTitle: "Settings",
    profileTitle: "Profile",
    languageTitle: "Language",
    account: "Account",
    accountDesc: "Number, username, bio",
    chatSettings: "Chat Settings",
    chatSettingsDesc: "Wallpapers, dark mode, animations",
    language: "Language",
    languageCurrent: "English",
    logout: "Log Out",
    chatName: "Display Name",
    username: "Username",
    bio: "Bio",
    bioPlaceholder: "Tell us about yourself...",
    channel: "Personal Channel",
    channelPlaceholder: "t.me/mychannel",
    birthday: "Birthday",
    infoVisible: "This information will be visible on your profile.",
    changePassword: "Change Password",
    newPassword: "New Password",
    saveChanges: "Save Changes",
    devNotice: "Coming soon",
    confirmLogout: "Log out of your account?",
    errorSave: "Error saving",
  }
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Текущий экран: 'main', 'profile', 'language'
  const [currentView, setCurrentView] = useState<'main' | 'profile' | 'language'>('main');
  
  // Язык
  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;
  
  const currentUserId = getUserId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('@');
  const [bio, setBio] = useState('');
  const [personalChannel, setPersonalChannel] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) {
          const data = await res.json();
          setUser(data); 
          setDisplayName(data.displayName || ''); 
          setUsername(data.username || '@');
          setBio(data.bio || ''); 
          setPersonalChannel(data.personalChannel || ''); 
          setBirthDate(data.birthDate || '');
        }
      } catch (e) {}
      setIsLoading(false);
    };
    fetchUser();
  }, [currentUserId]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('@')) val = '@' + val.replace(/@/g, '');
    if (val === '@') { setUsername('@'); return; }
    setUsername(val);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        await handleSave({ avatarUrl: data.secure_url }, true);
      }
    } catch (err) {}
    setIsUploading(false);
  };

  const handleSave = async (extraFields: any = {}, skipFeedback = false) => {
    if (!skipFeedback) setIsSaving(true);
    try {
      const payload: any = { displayName, username, bio, personalChannel, birthDate, ...extraFields };
      if (isChangingPassword && newPassword.trim() !== '') payload.password = newPassword;

      const res = await fetch('/api/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data); 
        localStorage.setItem('mesbook_user', JSON.stringify(data));
        
        const accounts = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
        const updatedAccounts = accounts.map((a: any) => String(a.id) === String(data.id) ? data : a);
        localStorage.setItem('mesbook_accounts', JSON.stringify(updatedAccounts));
        
        setNewPassword(''); 
        setIsChangingPassword(false);
        if (!skipFeedback && window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
      } else {
        alert(t.errorSave);
      }
    } catch (e) {}
    if (!skipFeedback) setIsSaving(false);
  };

  const handleLogout = () => {
    if (!window.confirm(t.confirmLogout)) return;
    const accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
    const filtered = accs.filter((a: any) => String(a.id) !== String(currentUserId));
    localStorage.setItem('mesbook_accounts', JSON.stringify(filtered));
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  const changeLanguage = (newLang: 'ru' | 'en') => {
    setLang(newLang);
    localStorage.setItem('mesbook_lang', newLang);
    // При желании можно сделать window.location.reload() для применения ко всему приложению
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f2f2f7] dark:bg-black"><Loader2 className="animate-spin text-gray-500" size={32} /></div>;

  // ==========================================
  // ЭКРАН 3: ВЫБОР ЯЗЫКА
  // ==========================================
  if (currentView === 'language') {
    return (
      <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative overflow-y-auto font-sans animate-in slide-in-from-right duration-200">
        <header className="flex items-center gap-6 px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900/50 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10 shadow-sm">
          <button onClick={() => setCurrentView('main')} className="text-black dark:text-white transition-colors active:scale-95">
            <ArrowLeft size={26} strokeWidth={2} />
          </button>
          <h1 className="text-[20px] font-semibold text-black dark:text-white tracking-wide">
            {t.languageTitle}
          </h1>
        </header>

        <main className="flex-1 p-4 w-full max-w-lg mx-auto">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 overflow-hidden flex flex-col mt-2">
            <button 
              onClick={() => changeLanguage('ru')}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50 w-full text-left"
            >
              <span className="text-[17px] text-black dark:text-white font-medium">Русский</span>
              {lang === 'ru' && <Check size={22} className="text-black dark:text-white" />}
            </button>
            <button 
              onClick={() => changeLanguage('en')}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors w-full text-left"
            >
              <span className="text-[17px] text-black dark:text-white font-medium">English</span>
              {lang === 'en' && <Check size={22} className="text-black dark:text-white" />}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // ЭКРАН 1: ГЛАВНОЕ МЕНЮ НАСТРОЕК (СТРОГИЙ МОНОХРОМ)
  // ==========================================
  if (currentView === 'main') {
    return (
      <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 font-sans">
        <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10">
          <button onClick={() => setLocation('/')} className="text-black dark:text-white transition-colors active:scale-95">
            <ArrowLeft size={26} strokeWidth={2} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-20 w-full max-w-lg mx-auto">
          {/* Блок профиля сверху */}
          <div className="flex flex-col items-center pb-8 pt-2">
            <div 
              className="relative w-[100px] h-[100px] rounded-full shadow-md bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200/50 dark:border-zinc-800 mb-4 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {user?.avatarUrl && user.avatarUrl.length > 5 ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[36px] font-medium text-black dark:text-white">{user?.displayName?.charAt(0).toUpperCase()}</span>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={24} /></div>
              )}
              <div className="absolute bottom-1.5 right-1/2 translate-x-1/2 text-white bg-black/40 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
                <Camera size={14} />
              </div>
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
            <h2 className="text-[22px] font-bold text-black dark:text-white leading-tight">{user?.displayName}</h2>
            <p className="text-[15px] text-gray-500 dark:text-zinc-400 mt-1">{user?.username}</p>
          </div>

          {/* Список настроек - СТРОГИЙ МОНОХРОМ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 overflow-hidden flex flex-col">
            <button 
              onClick={() => setCurrentView('profile')}
              className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50 w-full text-left"
            >
              <div className="w-[36px] h-[36px] rounded-[10px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-sm">
                <UserCircle size={22} />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-[16px] text-black dark:text-white font-medium">{t.account}</h3>
                <p className="text-[13px] text-gray-400 mt-0.5">{t.accountDesc}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 dark:text-zinc-600" />
            </button>

            <button 
              onClick={() => alert(t.devNotice)}
              className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-100/50 dark:border-zinc-800/50 w-full text-left"
            >
              <div className="w-[36px] h-[36px] rounded-[10px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-sm">
                <MessageCircle size={22} />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-[16px] text-black dark:text-white font-medium">{t.chatSettings}</h3>
                <p className="text-[13px] text-gray-400 mt-0.5">{t.chatSettingsDesc}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 dark:text-zinc-600" />
            </button>

            <button 
              onClick={() => setCurrentView('language')}
              className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors w-full text-left"
            >
              <div className="w-[36px] h-[36px] rounded-[10px] bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-sm">
                <Globe size={22} />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-[16px] text-black dark:text-white font-medium">{t.language}</h3>
                <p className="text-[13px] text-gray-400 mt-0.5">{t.languageCurrent}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 dark:text-zinc-600" />
            </button>
          </div>
          
          <div className="mt-8">
             <button 
              onClick={handleLogout} 
              className="w-full bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm px-5 py-4 flex items-center justify-center gap-3 text-black dark:text-white font-bold active:bg-gray-50 dark:active:bg-zinc-800 transition-colors text-[16px] border border-gray-100/50 dark:border-zinc-800/50"
            >
              <LogOut size={20} /> {t.logout}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // ЭКРАН 2: РЕДАКТИРОВАНИЕ ПРОФИЛЯ
  // ==========================================
  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative overflow-y-auto font-sans animate-in slide-in-from-right duration-200">
      
      <header className="flex items-center gap-6 px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900/50 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10 shadow-sm">
        <button onClick={() => setCurrentView('main')} className="text-black dark:text-white transition-colors active:scale-95">
          <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-semibold text-black dark:text-white tracking-wide">
          {t.profileTitle}
        </h1>
      </header>

      <main className="flex-1 p-4 pb-32 w-full max-w-lg mx-auto">
        <div className="space-y-5">
          
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 overflow-hidden mt-2">
            <div className="px-5 py-2.5 border-b border-gray-100/50 dark:border-zinc-900/60">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">{t.chatName}</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                className="w-full bg-transparent py-1.5 text-[17px] font-medium text-black dark:text-white outline-none" 
              />
            </div>
            <div className="px-5 py-2.5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">{t.username}</label>
              <input 
                type="text" 
                value={username} 
                onChange={handleUsernameChange} 
                className="w-full bg-transparent py-1.5 text-[17px] text-black dark:text-white outline-none" 
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 p-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t.bio}</label>
            <textarea 
              rows={3} 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder={t.bioPlaceholder} 
              className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none resize-none placeholder-gray-400" 
            />
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100/50 dark:border-zinc-900/60 flex items-center gap-4">
              <Volume2 size={22} className="text-gray-400" />
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t.channel}</label>
                <input 
                  type="text" 
                  value={personalChannel} 
                  onChange={e => setPersonalChannel(e.target.value)} 
                  placeholder={t.channelPlaceholder} 
                  className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none placeholder-gray-400" 
                />
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-4">
              <Calendar size={22} className="text-gray-400" />
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t.birthday}</label>
                <input 
                  type="date" 
                  value={birthDate} 
                  onChange={e => setBirthDate(e.target.value)} 
                  className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none" 
                />
              </div>
            </div>
          </div>
          <p className="text-[12px] text-gray-500 px-4 text-center">{t.infoVisible}</p>

          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100/50 dark:border-zinc-800/50 overflow-hidden">
            {!isChangingPassword ? (
              <button 
                onClick={() => setIsChangingPassword(true)} 
                className="w-full text-center px-5 py-4 text-[16px] font-bold text-black dark:text-white active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
              >
                {t.changePassword}
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <input 
                  autoFocus 
                  type="password" 
                  placeholder={t.newPassword} 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="flex-1 bg-gray-100 dark:bg-black rounded-xl px-4 py-3 text-[16px] text-black dark:text-white outline-none border border-gray-200/50 dark:border-zinc-800" 
                />
                <button 
                  onClick={() => { setIsChangingPassword(false); setNewPassword(''); }} 
                  className="p-3 bg-gray-100 dark:bg-black rounded-xl text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 left-0 w-full px-4 flex justify-center pointer-events-none z-20">
        <button 
          onClick={() => handleSave()} 
          disabled={isSaving || isUploading} 
          className="w-full max-w-sm py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-[24px] shadow-xl active:scale-95 transition-transform flex items-center justify-center pointer-events-auto text-[17px]"
        >
          {isSaving ? <Loader2 className="animate-spin" size={22} /> : t.saveChanges}
        </button>
      </div>

    </div>
  );
}
