import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Loader2, Camera, LogOut, Moon, Sun, User as UserIcon, Calendar, Link as LinkIcon, AtSign, Globe, Settings as SettingsIcon, ChevronRight, Check } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

const translations = {
  ru: {
    settings: "Настройки",
    account: "Аккаунт",
    accountDesc: "Номер, имя пользователя, «О себе»",
    chatSettings: "Настройки чатов",
    chatSettingsDesc: "Обои, ночной режим, анимации",
    language: "Язык",
    logout: "Выйти из аккаунта",
    profile: "Профиль",
    name: "Имя",
    username: "Имя пользователя",
    bio: "О себе",
    personalChannel: "Личный канал",
    birthDate: "Дата рождения",
    save: "Сохранить",
    uploading: "Загрузка..."
  },
  en: {
    settings: "Settings",
    account: "Account",
    accountDesc: "Number, username, Bio",
    chatSettings: "Chat Settings",
    chatSettingsDesc: "Wallpaper, dark mode, animations",
    language: "Language",
    logout: "Log Out",
    profile: "Profile",
    name: "Name",
    username: "Username",
    bio: "Bio",
    personalChannel: "Personal Channel",
    birthDate: "Birth Date",
    save: "Save",
    uploading: "Uploading..."
  }
};

export default function SettingsPage() {
  const currentUserId = getUserId();
  const [, setLocation] = useLocation();
  
  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [user, setUser] = useState<any>(null);
  const [isDark, setIsDark] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<'main' | 'profile'>('main');
  const [showLangModal, setShowLangModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    personalChannel: '',
    birthDate: ''
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    setIsDark(savedTheme === 'dark');

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setFormData({
            displayName: data.displayName || '',
            username: data.username || '',
            bio: data.bio || '',
            personalChannel: data.personalChannel || '',
            birthDate: data.birthDate || ''
          });
        }
      } catch (e) {}
    };
    fetchUser();
  }, [currentUserId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', 'mesogram-cloud'); 
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.secure_url) {
        const patchRes = await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
          body: JSON.stringify({ avatarUrl: data.secure_url })
        });
        if (patchRes.ok) {
          const updatedUser = await patchRes.json();
          setUser(updatedUser);
          localStorage.setItem('mesbook_user', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {}
    setIsUploading(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem('mesbook_user', JSON.stringify(updatedUser));
        setView('main');
      }
    } catch (e) {}
    setIsSaving(false);
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const changeLanguage = (newLang: 'ru' | 'en') => {
    setLang(newLang);
    localStorage.setItem('mesbook_lang', newLang);
    setShowLangModal(false);
    window.location.reload();
  };

  const handleLogout = () => {
    const accounts = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
    const newAccounts = accounts.filter((a: any) => String(a.id) !== String(currentUserId));
    localStorage.setItem('mesbook_accounts', JSON.stringify(newAccounts));
    if (newAccounts.length > 0) {
      localStorage.setItem('mesbook_user', JSON.stringify(newAccounts[0]));
    } else {
      localStorage.removeItem('mesbook_user');
    }
    window.location.href = '/';
  };

  if (!user) return <div className="flex h-[100dvh] items-center justify-center bg-[#f5f5f7] dark:bg-[#161618]"><Loader2 size={32} className="animate-spin text-[#86868b]" /></div>;

  const phoneDisplay = "+7 (996) 697-77-52"; 

  // --- ЭКРАН ПРОФИЛЯ ---
  if (view === 'profile') {
    return (
      <div className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans relative overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20">
        <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-[#f5f5f7]/90 dark:bg-[#161618]/90 sticky top-0 z-10 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
          <button onClick={() => setView('main')} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95 flex items-center gap-1">
            <ArrowLeft size={26} strokeWidth={2} /> 
          </button>
          <h1 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[18px] font-semibold absolute left-1/2 -translate-x-1/2 tracking-tight">{t.profile}</h1>
          <button onClick={handleSaveProfile} disabled={isSaving} className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[16px] active:opacity-70 transition-opacity">
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : t.save}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-[100px] h-[100px] rounded-full shadow-sm bg-white dark:bg-[#222224] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 cursor-pointer mb-3" onClick={() => fileInputRef.current?.click()}>
              {user.avatarUrl && user.avatarUrl.length > 5 ? (
                <img src={user.avatarUrl} className="w-full h-full object-cover" />
              ) : (
                <Camera size={36} className="text-[#86868b] dark:text-[#98989d]" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
          </div>

          <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden flex flex-col shadow-sm border border-black/5 dark:border-white/5">
            <div className="flex items-center px-4 py-3 border-b border-black/5 dark:border-white/5">
              <span className="w-[100px] text-[15px] text-[#86868b] dark:text-[#98989d]">{t.name}</span>
              <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="flex-1 bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div className="flex items-center px-4 py-3 border-b border-black/5 dark:border-white/5">
              <span className="w-[100px] text-[15px] text-[#86868b] dark:text-[#98989d]">{t.username}</span>
              <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="flex-1 bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div className="flex items-start px-4 py-3 border-b border-black/5 dark:border-white/5">
              <span className="w-[100px] text-[15px] text-[#86868b] dark:text-[#98989d] mt-0.5">{t.bio}</span>
              <textarea rows={2} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="flex-1 bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none" />
            </div>
            <div className="flex items-center px-4 py-3 border-b border-black/5 dark:border-white/5">
              <span className="w-[100px] text-[15px] text-[#86868b] dark:text-[#98989d]">{t.personalChannel}</span>
              <input type="text" value={formData.personalChannel} onChange={e => setFormData({...formData, personalChannel: e.target.value})} className="flex-1 bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div className="flex items-center px-4 py-3">
              <span className="w-[100px] text-[15px] text-[#86868b] dark:text-[#98989d]">{t.birthDate}</span>
              <input type="text" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="flex-1 bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- ГЛАВНЫЙ ЭКРАН НАСТРОЕК ---
  return (
    <div className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans relative overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20">
      
      <header className="flex items-center px-4 pt-12 pb-4 bg-white/80 dark:bg-[#222224]/80 sticky top-0 z-10 shadow-[0_1px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <button onClick={() => setLocation('/')} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95 mr-4">
           <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <h1 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[22px] font-bold tracking-tight">{t.settings}</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
        
        {/* Аватарка */}
        <div className="flex flex-col items-center pt-2 pb-8">
          <div className="w-[110px] h-[110px] rounded-full bg-[#e5e5ea] dark:bg-[#333336] text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center text-[40px] font-medium mb-3 border border-black/5 dark:border-white/5 shadow-sm">
            {user.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span>{user.displayName?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h2 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{user.displayName}</h2>
          <p className="text-[15px] text-[#86868b] dark:text-[#98989d] mt-0.5">{phoneDisplay} • {user.username}</p>
        </div>

        {/* Основные настройки - Строгий монохром */}
        <div className="mb-6">
           <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden flex flex-col shadow-sm border border-black/5 dark:border-white/5">
               <button onClick={() => setView('profile')} className="flex items-center justify-between px-4 py-3.5 w-full text-left border-b border-black/5 dark:border-white/5 active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-[10px] bg-[#f5f5f7] dark:bg-[#333336] flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]"><UserIcon size={20}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">{t.account}</span>
                       <span className="text-[13px] text-[#86868b] dark:text-[#98989d] leading-tight mt-0.5">{t.accountDesc}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-[#86868b] dark:text-[#98989d]" />
               </button>

               <button onClick={toggleTheme} className="flex items-center justify-between px-4 py-3.5 w-full text-left border-b border-black/5 dark:border-white/5 active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-[10px] bg-[#f5f5f7] dark:bg-[#333336] flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]"><SettingsIcon size={20}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">{t.chatSettings}</span>
                       <span className="text-[13px] text-[#86868b] dark:text-[#98989d] leading-tight mt-0.5">{t.chatSettingsDesc}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDark ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7]' : 'bg-[#e5e5ea] dark:bg-[#333336]'}`}>
                    <div className={`w-4 h-4 bg-white dark:bg-[#1d1d1f] rounded-full transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
               </button>

               <button onClick={() => setShowLangModal(true)} className="flex items-center justify-between px-4 py-3.5 w-full text-left active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-[10px] bg-[#f5f5f7] dark:bg-[#333336] flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]"><Globe size={20}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">{t.language}</span>
                       <span className="text-[13px] text-[#86868b] dark:text-[#98989d] leading-tight mt-0.5 uppercase">{lang}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-[#86868b] dark:text-[#98989d]" />
               </button>
           </div>
        </div>

        {/* Логаут - Монохром */}
        <div className="mb-8">
           <div className="bg-white dark:bg-[#222224] rounded-[20px] overflow-hidden shadow-sm border border-black/5 dark:border-white/5">
               <button onClick={handleLogout} className="flex items-center justify-center w-full px-4 py-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[16px] active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors">
                  {t.logout}
               </button>
           </div>
        </div>
      </main>

      {/* Модалка выбора языка */}
      {showLangModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/20 dark:bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLangModal(false)}>
           <div className="w-full max-w-sm bg-[#f5f5f7] dark:bg-[#161618] rounded-t-[24px] sm:rounded-[24px] p-6 pb-10 sm:pb-6 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
              <h3 className="text-[18px] font-bold mb-5 text-center text-[#1d1d1f] dark:text-[#f5f5f7]">{t.language}</h3>
              <div className="flex flex-col gap-3">
                 <button onClick={() => changeLanguage('ru')} className={`flex items-center justify-between p-4 rounded-[16px] border transition-colors ${lang === 'ru' ? 'border-[#1d1d1f] dark:border-[#f5f5f7] bg-white dark:bg-[#222224]' : 'border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#222224]/50'}`}>
                   <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">Русский</span>
                   {lang === 'ru' && <Check size={20} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
                 </button>
                 <button onClick={() => changeLanguage('en')} className={`flex items-center justify-between p-4 rounded-[16px] border transition-colors ${lang === 'en' ? 'border-[#1d1d1f] dark:border-[#f5f5f7] bg-white dark:bg-[#222224]' : 'border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#222224]/50'}`}>
                   <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">English</span>
                   {lang === 'en' && <Check size={20} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
