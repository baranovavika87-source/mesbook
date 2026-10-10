import { useState, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, User, MessageSquare, Lock, Bell, Globe, ChevronRight, LogOut, Camera, Loader2, X, Check } from 'lucide-react';

const translations = {
  ru: {
    settings: "Настройки",
    account: "Аккаунт",
    accountSub: "Номер, имя пользователя, «О себе»",
    chatSettings: "Настройки чатов",
    chatSettingsSub: "Обои, ночная тема, анимации",
    privacy: "Конфиденциальность",
    privacySub: "Время захода, устройства, ключи доступа",
    notifications: "Уведомления",
    notificationsSub: "Звуки, звонки, счётчик сообщений",
    language: "Язык",
    languageSub: "Русский",
    logout: "Выйти из аккаунта",
    editProfile: "Изменить профиль",
    name: "Имя",
    username: "Никнейм (@username)",
    bio: "О себе",
    birthday: "Дата рождения",
    cancel: "Отмена",
    save: "Сохранить",
    russian: "Русский",
    english: "English"
  },
  en: {
    settings: "Settings",
    account: "Account",
    accountSub: "Number, username, bio",
    chatSettings: "Chat Settings",
    chatSettingsSub: "Wallpaper, Night Mode, Animations",
    privacy: "Privacy",
    privacySub: "Last seen, devices, passkeys",
    notifications: "Notifications",
    notificationsSub: "Sounds, calls, message counter",
    language: "Language",
    languageSub: "English",
    logout: "Log Out",
    editProfile: "Edit Profile",
    name: "Name",
    username: "Username (@username)",
    bio: "Bio",
    birthday: "Birthday",
    cancel: "Cancel",
    save: "Save",
    russian: "Русский",
    english: "English"
  }
};

type ViewState = 'main' | 'edit' | 'privacy' | 'language';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('mesbook_user') || '{}'); } catch(e) { return {}; }
  });

  const [lang, setLang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [activeView, setActiveView] = useState<ViewState>('main');

  const [editName, setEditName] = useState(currentUser?.displayName || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editBirthDate, setEditBirthDate] = useState(currentUser?.birthDate || '');
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatarUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  const selectLanguage = (newLang: 'ru' | 'en') => {
    localStorage.setItem('mesbook_lang', newLang);
    setLang(newLang);
    window.location.reload();
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
      if (data.secure_url) setEditAvatar(data.secure_url);
    } catch (err) {}
    setIsUploading(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentUser.id
        },
        body: JSON.stringify({
          displayName: editName,
          username: editUsername,
          bio: editBio,
          birthDate: editBirthDate,
          avatarUrl: editAvatar
        })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        localStorage.setItem('mesbook_user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        
        try {
           let accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
           accs = accs.map((a: any) => String(a.id) === String(updatedUser.id) ? updatedUser : a);
           localStorage.setItem('mesbook_accounts', JSON.stringify(accs));
        } catch(e) {}
        
        setActiveView('main');
      }
    } catch (e) {}
    setIsSaving(false);
  };

  // Универсальный компонент для списков
  const SettingItem = ({ icon, title, subtitle, onClick, hasBorder = true }: any) => (
    <button onClick={onClick} className={`flex items-center gap-4 px-4 py-3.5 active:bg-black/5 dark:active:bg-white/5 transition-colors w-full text-left ${hasBorder ? 'border-b border-black/5 dark:border-white/5' : ''}`}>
       <div className="w-[38px] h-[38px] flex-shrink-0 flex items-center justify-center rounded-[12px] bg-[#f5f5f7] dark:bg-[#161618] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
          {icon}
       </div>
       <div className="flex flex-col flex-1 overflow-hidden pr-2">
          <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{title}</span>
          <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate mt-[1px]">{subtitle}</span>
       </div>
       <ChevronRight size={18} className="text-[#86868b] dark:text-[#98989d] flex-shrink-0" />
    </button>
  );

  // --- ЭКРАН РЕДАКТИРОВАНИЯ ПРОФИЛЯ ---
  if (activeView === 'edit') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center justify-between px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView('main')} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><X size={26} strokeWidth={2} /></button>
            <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.editProfile}</h1>
          </div>
          {/* Текстовая кнопка "Сохранить" вместо галочки */}
          <button onClick={handleSaveProfile} disabled={isSaving} className="text-[#1d1d1f] dark:text-[#f5f5f7] px-2 py-1 active:scale-95 transition-transform font-medium text-[16px]">
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : t.save}
          </button>
        </header>

        <div className="px-4 pt-8 w-full max-w-lg mx-auto flex flex-col gap-5 pb-10">
          <div className="flex justify-center mb-4">
            <div className="w-[120px] h-[120px] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] bg-[#0f172a] dark:bg-[#222224] flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              {editAvatar && editAvatar.length > 5 ? (
                <img src={editAvatar} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[40px] font-medium text-white">{editName.charAt(0).toUpperCase()}</span>
              )}
              
              {/* Маленькая иконка камеры по центру */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-10 h-10 rounded-full flex items-center justify-center">
                    <Camera size={24} strokeWidth={1.5} className="text-white opacity-80" />
                 </div>
              </div>
              
              {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"><Loader2 size={24} className="text-white animate-spin" /></div>}
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
          </div>

          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden border border-black/5 dark:border-white/5 flex flex-col">
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
              <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mt-1">{t.name}</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent py-1.5 text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
              <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mt-1">{t.username}</label>
              <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-transparent py-1.5 text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
              <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mt-1">{t.birthday}</label>
              <input type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} className="w-full bg-transparent py-1.5 text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
            <div className="px-5 py-4">
              <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-2">{t.bio}</label>
              <textarea rows={3} value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full bg-transparent text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none" placeholder="Расскажите немного о себе..." />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ЭКРАН КОНФИДЕНЦИАЛЬНОСТИ (С ВЫХОДОМ ИЗ АККАУНТА) ---
  if (activeView === 'privacy') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5">
          <button onClick={() => setActiveView('main')} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.privacy}</h1>
        </header>

        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full pt-6">
           <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
              {/* Логаут перенесен сюда */}
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 p-4 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[16px] hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors w-full">
                 <LogOut size={20} strokeWidth={2.5} className="mr-1" />
                 {t.logout}
              </button>
           </div>
        </div>
      </div>
    );
  }

  // --- ЭКРАН ВЫБОРА ЯЗЫКА ---
  if (activeView === 'language') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5">
          <button onClick={() => setActiveView('main')} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.language}</h1>
        </header>

        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full pt-6">
           <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
              <button onClick={() => selectLanguage('ru')} className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5 active:bg-black/5 dark:active:bg-white/5 transition-colors">
                 <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">Русский</span>
                 {lang === 'ru' && <Check size={20} strokeWidth={2.5} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
              </button>
              <button onClick={() => selectLanguage('en')} className="flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors">
                 <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">English</span>
                 {lang === 'en' && <Check size={20} strokeWidth={2.5} className="text-[#1d1d1f] dark:text-[#f5f5f7]" />}
              </button>
           </div>
        </div>
      </div>
    );
  }

  // --- ГЛАВНЫЙ ЭКРАН НАСТРОЕК ---
  return (
    <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20 animate-in slide-in-from-right-8 fade-in duration-300 ease-out">
      <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10">
        <Link href="/"><a className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></a></Link>
        <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.settings}</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-10">
        {/* Profile Info */}
        <div className="flex flex-col items-center pt-2 pb-6">
           <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-[#e5e5ea] dark:bg-[#333336] border border-black/5 dark:border-white/5 mb-3 shadow-sm flex items-center justify-center">
             {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-[32px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}</span>}
           </div>
           <h2 className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{currentUser?.displayName || 'Пользователь'}</h2>
           <p className="text-[15px] text-[#86868b] dark:text-[#98989d] mt-0.5">{currentUser?.username || '@username'}</p>
        </div>

        {/* Settings Group (Единый блок) */}
        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
           <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
              <SettingItem 
                icon={<User size={20} strokeWidth={2.5} />} 
                title={t.account} 
                subtitle={t.accountSub} 
                onClick={() => setActiveView('edit')} 
                hasBorder={true}
              />
              <SettingItem 
                icon={<MessageSquare size={20} strokeWidth={2.5} />} 
                title={t.chatSettings} 
                subtitle={t.chatSettingsSub} 
                hasBorder={true}
              />
              <SettingItem 
                icon={<Lock size={20} strokeWidth={2.5} />} 
                title={t.privacy} 
                subtitle={t.privacySub} 
                onClick={() => setActiveView('privacy')}
                hasBorder={true}
              />
              <SettingItem 
                icon={<Bell size={20} strokeWidth={2.5} />} 
                title={t.notifications} 
                subtitle={t.notificationsSub} 
                hasBorder={true}
              />
              {/* Вызов нового экрана языков */}
              <SettingItem 
                icon={<Globe size={20} strokeWidth={2.5} />} 
                title={t.language} 
                subtitle={lang === 'ru' ? t.russian : t.english} 
                onClick={() => setActiveView('language')} 
                hasBorder={false}
              />
           </div>
        </div>
      </main>
    </div>
  );
}
