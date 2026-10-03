import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Loader2, Camera, LogOut, Moon, Sun, User as UserIcon, Calendar, Link as LinkIcon, AtSign, Globe, Settings as SettingsIcon, MessageSquare, ChevronRight, Check } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

const translations = {
  ru: {
    settings: "Настройки",
    accounts: "Аккаунты",
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
    accounts: "Accounts",
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
  
  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<'main' | 'profile'>('main');
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

    try {
      const accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
      setAccounts(accs);
    } catch(e) {}

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

  const toggleLanguage = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLang(newLang);
    localStorage.setItem('mesbook_lang', newLang);
    window.location.reload();
  };

  const switchAccount = (acc: any) => {
    localStorage.setItem('mesbook_user', JSON.stringify(acc));
    window.location.reload();
  };

  const handleLogout = () => {
    const accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
    const newAccounts = accs.filter((a: any) => String(a.id) !== String(currentUserId));
    localStorage.setItem('mesbook_accounts', JSON.stringify(newAccounts));
    if (newAccounts.length > 0) {
      localStorage.setItem('mesbook_user', JSON.stringify(newAccounts[0]));
    } else {
      localStorage.removeItem('mesbook_user');
    }
    window.location.href = '/';
  };

  if (!user) return <div className="flex h-[100dvh] items-center justify-center bg-black"><Loader2 size={32} className="animate-spin text-white" /></div>;

  const phoneDisplay = "+7 (996) 697-77-52"; 

  if (view === 'profile') {
    return (
      <div className="flex h-[100dvh] flex-col bg-black transition-colors duration-300 font-sans relative overflow-hidden">
        <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-black sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('main')} className="text-blue-500 transition-transform active:scale-95 flex items-center gap-1">
              <ArrowLeft size={24} /> <span className="text-[17px] font-medium">{t.settings}</span>
            </button>
          </div>
          <button onClick={handleSaveProfile} disabled={isSaving} className="text-blue-500 font-medium text-[17px] active:opacity-70 transition-opacity">
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : t.save}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
          <div className="bg-[#1c1c1e] rounded-[10px] overflow-hidden flex flex-col">
            <div className="flex items-center px-4 py-2 border-b border-white/10">
              <UserIcon size={20} className="text-gray-400 shrink-0 mr-3" />
              <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} placeholder={t.name} className="flex-1 bg-transparent py-2 text-[16px] text-white outline-none placeholder-gray-500" />
            </div>
            <div className="flex items-center px-4 py-2 border-b border-white/10">
              <AtSign size={20} className="text-gray-400 shrink-0 mr-3" />
              <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder={t.username} className="flex-1 bg-transparent py-2 text-[16px] text-white outline-none placeholder-gray-500" />
            </div>
            <div className="flex items-start px-4 py-2 border-b border-white/10">
              <textarea rows={2} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder={t.bio} className="flex-1 bg-transparent py-2 text-[16px] text-white outline-none resize-none placeholder-gray-500" />
            </div>
            <div className="flex items-center px-4 py-2 border-b border-white/10">
              <LinkIcon size={20} className="text-gray-400 shrink-0 mr-3" />
              <input type="text" value={formData.personalChannel} onChange={e => setFormData({...formData, personalChannel: e.target.value})} placeholder={t.personalChannel} className="flex-1 bg-transparent py-2 text-[16px] text-white outline-none placeholder-gray-500" />
            </div>
            <div className="flex items-center px-4 py-2">
              <Calendar size={20} className="text-gray-400 shrink-0 mr-3" />
              <input type="text" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} placeholder={t.birthDate} className="flex-1 bg-transparent py-2 text-[16px] text-white outline-none placeholder-gray-500" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-black transition-colors duration-300 font-sans relative overflow-hidden text-white">
      
      <main className="flex-1 overflow-y-auto px-4 pt-12 pb-20">
        
        {/* Аватарка */}
        <div className="flex flex-col items-center pt-2 pb-6">
          <div className="w-[100px] h-[100px] rounded-full bg-blue-500 text-white flex items-center justify-center text-[40px] font-medium relative mb-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {user.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span>{user.displayName?.charAt(0).toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-black rounded-full flex items-center justify-center">
               <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white">
                 {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={14}/>}
               </div>
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
          
          <h2 className="text-[22px] font-semibold tracking-tight">{user.displayName}</h2>
          <p className="text-[15px] text-gray-400 mt-1">{phoneDisplay} • {user.username}</p>
        </div>

        {/* Аккаунты */}
        <div className="mb-6">
           <h3 className="text-[13px] font-semibold text-gray-500 ml-4 mb-1.5 uppercase tracking-wide">{t.accounts}</h3>
           <div className="bg-[#1c1c1e] rounded-[10px] overflow-hidden">
               {accounts.map((acc, index) => {
                 const isActive = String(acc.id) === String(currentUserId);
                 return (
                   <button key={acc.id} onClick={() => !isActive && switchAccount(acc)} className={`flex items-center justify-between w-full px-4 py-2.5 transition-colors ${index !== accounts.length - 1 ? 'border-b border-white/5' : ''} ${isActive ? 'cursor-default' : 'active:bg-white/5'}`}>
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[14px]">
                         {acc.avatarUrl && acc.avatarUrl.length > 5 ? <img src={acc.avatarUrl} className="w-full h-full object-cover rounded-full" /> : acc.displayName?.charAt(0).toUpperCase()}
                       </div>
                       <span className="text-[16px] font-medium">{acc.displayName}</span>
                     </div>
                     {isActive && (
                       <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                         <Check size={14} className="text-white" />
                       </div>
                     )}
                   </button>
                 );
               })}
           </div>
        </div>

        {/* Основные настройки */}
        <div className="mb-6">
           <div className="bg-[#1c1c1e] rounded-[10px] overflow-hidden flex flex-col">
               <button onClick={() => setView('profile')} className="flex items-center justify-between px-4 py-2.5 w-full text-left border-b border-white/5 active:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-[8px] bg-blue-500 flex items-center justify-center text-white"><UserIcon size={18}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium leading-tight">{t.account}</span>
                       <span className="text-[13px] text-gray-500 leading-tight mt-0.5">{t.accountDesc}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-500" />
               </button>

               <button onClick={toggleTheme} className="flex items-center justify-between px-4 py-2.5 w-full text-left border-b border-white/5 active:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-[8px] bg-orange-500 flex items-center justify-center text-white"><SettingsIcon size={18}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium leading-tight">{t.chatSettings}</span>
                       <span className="text-[13px] text-gray-500 leading-tight mt-0.5">{t.chatSettingsDesc}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-500" />
               </button>

               <button onClick={toggleLanguage} className="flex items-center justify-between px-4 py-2.5 w-full text-left active:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-[8px] bg-purple-500 flex items-center justify-center text-white"><Globe size={18}/></div>
                    <div className="flex flex-col">
                       <span className="text-[16px] font-medium leading-tight">{t.language}</span>
                       <span className="text-[13px] text-gray-500 leading-tight mt-0.5 uppercase">{lang}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-500" />
               </button>
           </div>
        </div>

        {/* Логаут */}
        <div className="mb-8">
           <div className="bg-[#1c1c1e] rounded-[10px] overflow-hidden">
               <button onClick={handleLogout} className="flex items-center justify-center w-full px-4 py-3.5 text-red-500 font-medium text-[16px] active:bg-white/5 transition-colors">
                  {t.logout}
               </button>
           </div>
        </div>

      </main>

      <nav className="border-t border-white/10 flex justify-around p-3 bg-[#1c1c1e]/90 backdrop-blur-xl z-10 pb-6">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-500 hover:text-white transition-colors active:scale-95">
            <MessageSquare size={26} className="mb-1" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide">Чаты</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-white transition-transform active:scale-95">
            <SettingsIcon size={26} className="mb-1" fill="currentColor" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide">{t.settings}</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
