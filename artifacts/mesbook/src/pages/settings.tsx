import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Camera, Loader2, X, Calendar, Volume2, LogOut } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
          setUser(data); setDisplayName(data.displayName || ''); setUsername(data.username || '@');
          setBio(data.bio || ''); setPersonalChannel(data.personalChannel || ''); setBirthDate(data.birthDate || '');
        }
      } catch (e) {}
      setIsLoading(false);
    };
    fetchUser();
  }, [currentUserId]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('@')) val = '@' + val.replace(/@/g, '');
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
      if (data.secure_url) await handleSave({ avatarUrl: data.secure_url });
    } catch (err) {}
    setIsUploading(false);
  };

  const handleSave = async (extraFields: any = {}) => {
    setIsSaving(true);
    try {
      const payload: any = { displayName, username, bio, personalChannel, birthDate, ...extraFields };
      if (isChangingPassword && newPassword.trim() !== '') payload.password = newPassword;

      const res = await fetch('/api/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data); localStorage.setItem('mesbook_user', JSON.stringify(data));
        const accounts = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
        const updatedAccounts = accounts.map((a: any) => String(a.id) === String(data.id) ? data : a);
        localStorage.setItem('mesbook_accounts', JSON.stringify(updatedAccounts));
        setNewPassword(''); setIsChangingPassword(false);
      } else {
        const err = await res.json(); alert(err.error || "Ошибка сохранения");
      }
    } catch (e) {}
    setIsSaving(false);
  };

  const handleLogout = () => {
    if (!window.confirm("Выйти из аккаунта?")) return;
    const accs = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
    const filtered = accs.filter((a: any) => String(a.id) !== String(currentUserId));
    localStorage.setItem('mesbook_accounts', JSON.stringify(filtered));
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f2f2f7] dark:bg-black"><Loader2 className="animate-spin text-gray-500" size={32} /></div>;

  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 relative overflow-y-auto font-sans">
      
      <header className="flex items-center gap-6 px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900/50 sticky top-0 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10 shadow-sm">
        <button onClick={() => setLocation('/')} className="text-black dark:text-white transition-colors active:scale-95">
          <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-semibold text-black dark:text-white tracking-wide">
          Профиль
        </h1>
      </header>

      <main className="flex-1 p-4 pb-32 w-full max-w-lg mx-auto">
        
        {/* АВАТАР */}
        <div className="flex justify-center mb-6 relative">
          <div 
            className="relative w-[120px] h-[120px] rounded-full shadow-md bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-800 cursor-pointer" 
            onClick={() => fileInputRef.current?.click()}
          >
            {user?.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[40px] font-medium text-black dark:text-white">{user?.displayName?.charAt(0).toUpperCase()}</span>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={24} />
              </div>
            )}
            <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-white bg-black/50 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
              <Camera size={16} />
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
        </div>

        <div className="space-y-5">
          
          {/* БЛОК 1: ИМЯ И НИКНЕЙМ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100 dark:border-zinc-800/50 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-gray-100 dark:border-zinc-900/60">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">Имя в чате</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                className="w-full bg-transparent py-1.5 text-[17px] font-medium text-black dark:text-white outline-none" 
              />
            </div>
            <div className="px-5 py-2.5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">Никнейм</label>
              <input 
                type="text" 
                value={username} 
                onChange={handleUsernameChange} 
                className="w-full bg-transparent py-1.5 text-[17px] text-black dark:text-white outline-none" 
              />
            </div>
          </div>

          {/* БЛОК 2: О СЕБЕ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100 dark:border-zinc-800/50 p-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">О себе</label>
            <textarea 
              rows={3} 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder="Расскажите немного о себе..." 
              className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none resize-none placeholder-gray-400" 
            />
          </div>

          {/* БЛОК 3: КАНАЛ И ДЕНЬ РОЖДЕНИЯ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100 dark:border-zinc-800/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-900/60 flex items-center gap-4">
              <Volume2 size={22} className="text-gray-400" />
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Личный Канал</label>
                <input 
                  type="text" 
                  value={personalChannel} 
                  onChange={e => setPersonalChannel(e.target.value)} 
                  placeholder="t.me/мойканал" 
                  className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none placeholder-gray-400" 
                />
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-4">
              <Calendar size={22} className="text-gray-400" />
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">День рождения</label>
                <input 
                  type="date" 
                  value={birthDate} 
                  onChange={e => setBirthDate(e.target.value)} 
                  className="w-full bg-transparent text-[16px] text-black dark:text-white outline-none" 
                />
              </div>
            </div>
          </div>
          <p className="text-[12px] text-gray-500 px-4 text-center">Эта информация будет видна в вашем профиле.</p>

          {/* БЛОК 4: ПАРОЛЬ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100 dark:border-zinc-800/50 overflow-hidden">
            {!isChangingPassword ? (
              <button 
                onClick={() => setIsChangingPassword(true)} 
                className="w-full text-center px-5 py-4 text-[16px] font-semibold text-blue-500 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
              >
                Изменить пароль
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <input 
                  autoFocus 
                  type="password" 
                  placeholder="Новый пароль" 
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

          {/* БЛОК 5: ВЫХОД */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-sm border border-gray-100 dark:border-zinc-800/50 overflow-hidden mt-6">
             <button 
              onClick={handleLogout} 
              className="w-full px-5 py-4 flex items-center justify-center gap-3 text-red-500 font-semibold active:bg-gray-50 dark:active:bg-zinc-800 transition-colors text-[16px]"
            >
              Выйти из аккаунта
            </button>
          </div>
          
        </div>
      </main>

      {/* ПЛАВАЮЩАЯ КНОПКА СОХРАНЕНИЯ */}
      <div className="fixed bottom-6 left-0 w-full px-4 flex justify-center pointer-events-none z-20">
        <button 
          onClick={() => handleSave()} 
          disabled={isSaving || isUploading} 
          className="w-full max-w-sm py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-[20px] shadow-xl active:scale-95 transition-transform flex items-center justify-center pointer-events-auto text-[17px]"
        >
          {isSaving ? <Loader2 className="animate-spin" size={22} /> : 'Сохранить изменения'}
        </button>
      </div>

    </div>
  );
}
