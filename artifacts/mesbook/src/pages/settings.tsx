import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Loader2, Camera, LogOut, Moon, Sun, User as UserIcon, Calendar, Link as LinkIcon, AtSign, Globe } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

const translations = {
  ru: {
    settings: "Настройки",
    profile: "Профиль",
    name: "Имя",
    username: "Имя пользователя",
    bio: "О себе",
    personalChannel: "Личный канал",
    birthDate: "Дата рождения",
    appearance: "Внешний вид",
    theme: "Темная тема",
    language: "Язык приложения",
    logout: "Выйти из аккаунта",
    save: "Сохранить",
    uploading: "Загрузка..."
  },
  en: {
    settings: "Settings",
    profile: "Profile",
    name: "Name",
    username: "Username",
    bio: "Bio",
    personalChannel: "Personal Channel",
    birthDate: "Birth Date",
    appearance: "Appearance",
    theme: "Dark Mode",
    language: "App Language",
    logout: "Log Out",
    save: "Save",
    uploading: "Uploading..."
  }
};

export default function SettingsPage() {
  const currentUserId = getUserId();
  
  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [user, setUser] = useState<any>(null);
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const handleSave = async () => {
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

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans relative overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20">
      
      <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-[#f5f5f7]/90 dark:bg-[#161618]/90 sticky top-0 z-10 shadow-[0_1px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <Link href="/">
          <a className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a>
        </Link>
        <h1 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[18px] font-semibold absolute left-1/2 -translate-x-1/2 tracking-tight">{t.settings}</h1>
        <div className="w-[26px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
        
        {/* Аватарка */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[120px] h-[120px] rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.05)] bg-white dark:bg-[#222224] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 cursor-pointer mb-3" onClick={() => fileInputRef.current?.click()}>
            {user.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} className="w-full h-full object-cover" />
            ) : (
              <Camera size={40} className="text-[#86868b] dark:text-[#98989d]" />
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
          <h2 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{user.displayName}</h2>
          <p className="text-[15px] text-[#86868b] dark:text-[#98989d]">{user.username}</p>
        </div>

        {/* Форма профиля */}
        <div className="mb-8">
          <h3 className="px-4 text-[13px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-2">{t.profile}</h3>
          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
            
            <div className="flex items-center px-4 py-1.5 border-b border-black/5 dark:border-white/5">
              <UserIcon size={20} className="text-[#86868b] dark:text-[#98989d] shrink-0 mr-3" />
              <div className="flex-1 py-2">
                <input 
                  type="text" 
                  value={formData.displayName} 
                  onChange={e => setFormData({...formData, displayName: e.target.value})} 
                  placeholder={t.name}
                  className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none placeholder-[#86868b]/50" 
                />
              </div>
            </div>

            <div className="flex items-center px-4 py-1.5 border-b border-black/5 dark:border-white/5">
              <AtSign size={20} className="text-[#86868b] dark:text-[#98989d] shrink-0 mr-3" />
              <div className="flex-1 py-2">
                <input 
                  type="text" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                  placeholder={t.username}
                  className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none placeholder-[#86868b]/50" 
                />
              </div>
            </div>

            <div className="flex items-start px-4 py-3.5 border-b border-black/5 dark:border-white/5">
              <div className="flex-1">
                <textarea 
                  rows={2}
                  value={formData.bio} 
                  onChange={e => setFormData({...formData, bio: e.target.value})} 
                  placeholder={t.bio}
                  className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none placeholder-[#86868b]/50" 
                />
              </div>
            </div>

            <div className="flex items-center px-4 py-1.5 border-b border-black/5 dark:border-white/5">
              <LinkIcon size={20} className="text-[#86868b] dark:text-[#98989d] shrink-0 mr-3" />
              <div className="flex-1 py-2">
                <input 
                  type="text" 
                  value={formData.personalChannel} 
                  onChange={e => setFormData({...formData, personalChannel: e.target.value})} 
                  placeholder={t.personalChannel}
                  className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none placeholder-[#86868b]/50" 
                />
              </div>
            </div>

            <div className="flex items-center px-4 py-1.5">
              <Calendar size={20} className="text-[#86868b] dark:text-[#98989d] shrink-0 mr-3" />
              <div className="flex-1 py-2">
                <input 
                  type="text" 
                  value={formData.birthDate} 
                  onChange={e => setFormData({...formData, birthDate: e.target.value})} 
                  placeholder={t.birthDate}
                  className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none placeholder-[#86868b]/50" 
                />
              </div>
            </div>

          </div>
          
          <div className="mt-4 px-2">
             <button 
               onClick={handleSave} 
               disabled={isSaving}
               className="w-full py-3.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] font-semibold rounded-[18px] transition-transform active:scale-95 shadow-[0_4px_15px_rgba(0,0,0,0.1)] dark:shadow-none flex items-center justify-center"
             >
               {isSaving ? <Loader2 size={20} className="animate-spin" /> : t.save}
             </button>
          </div>
        </div>

        {/* Настройки приложения */}
        <div className="mb-8">
          <h3 className="px-4 text-[13px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-2">{t.appearance}</h3>
          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
            
            <button onClick={toggleTheme} className="flex items-center justify-between px-4 py-4 border-b border-black/5 dark:border-white/5 active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors text-left">
              <div className="flex items-center gap-3.5">
                {isDark ? <Moon size={22} className="text-[#86868b]" /> : <Sun size={22} className="text-[#86868b]" />}
                <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{t.theme}</span>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDark ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </button>

            <button onClick={toggleLanguage} className="flex items-center justify-between px-4 py-4 active:bg-black/[0.02] dark:active:bg-white/[0.02] transition-colors text-left">
              <div className="flex items-center gap-3.5">
                <Globe size={22} className="text-[#86868b]" />
                <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{t.language}</span>
              </div>
              <span className="text-[15px] font-semibold text-[#86868b] dark:text-[#98989d] uppercase">{lang}</span>
            </button>

          </div>
        </div>

        {/* Логаут */}
        <div className="pb-10">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#222224] text-red-500 rounded-[24px] py-4 shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 active:scale-95 transition-transform font-medium text-[16px]">
            <LogOut size={20} />
            {t.logout}
          </button>
        </div>

      </main>
    </div>
  );
}
