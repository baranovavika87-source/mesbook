import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Camera, Loader2, Check, X, Calendar, Volume2 } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const currentUserId = getUserId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Поля формы
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [personalChannel, setPersonalChannel] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  // Пароль вынесен в отдельный блок
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setDisplayName(data.displayName || '');
          setUsername(data.username || '');
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
    // Жестко форсируем собачку @
    if (!val.startsWith('@')) {
      val = '@' + val.replace(/@/g, '');
    }
    // Если пользователь стер всё, оставляем только @
    if (val === '@') {
      setUsername('@');
      return;
    }
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
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        await handleSave({ avatarUrl: data.secure_url });
      }
    } catch (err) {}
    setIsUploading(false);
  };

  const handleSave = async (extraFields: any = {}) => {
    setIsSaving(true);
    try {
      const payload: any = { 
        displayName, 
        username, 
        bio,
        personalChannel,
        birthDate,
        ...extraFields 
      };
      
      if (isChangingPassword && newPassword.trim() !== '') {
        payload.password = newPassword;
      }

      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentUserId
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('mesbook_user', JSON.stringify(data));
        
        // Обновляем в списке мультиаккаунтов
        const accounts = JSON.parse(localStorage.getItem('mesbook_accounts') || '[]');
        const updatedAccounts = accounts.map((a: any) => String(a.id) === String(data.id) ? data : a);
        localStorage.setItem('mesbook_accounts', JSON.stringify(updatedAccounts));

        setNewPassword('');
        setIsChangingPassword(false);
        // Небольшой фидбек
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-white dark:bg-black"><Loader2 className="animate-spin text-gray-500" size={32} /></div>;
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300 relative overflow-y-auto">
      
      <header className="flex items-center gap-6 px-4 pt-12 pb-4 border-b border-gray-100 dark:border-zinc-900 sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-md z-10">
        <button onClick={() => setLocation('/')} className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-black dark:text-white uppercase tracking-wide">
          Профиль
        </h1>
      </header>

      <main className="flex-1 p-6 pb-20 max-w-lg mx-auto w-full">
        
        {/* Аватар */}
        <div className="flex justify-center mb-8 relative">
          <div className="relative w-32 h-32 rounded-full border-4 border-white dark:border-black shadow-lg bg-gray-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl && user.avatarUrl.length > 5 ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-semibold text-black dark:text-white">{user?.displayName?.charAt(0).toUpperCase()}</span>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={24} />
              </div>
            )}
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-1/2 translate-x-12 bg-black dark:bg-white text-white dark:text-black p-3 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform"
          >
            <Camera size={18} />
          </button>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
        </div>

        <div className="space-y-6">
          {/* Имя */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 ml-1">Имя в чате</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-transparent border-b border-gray-300 dark:border-zinc-700 py-2.5 text-[17px] text-black dark:text-white placeholder-gray-400 outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* Никнейм */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 ml-1">Никнейм (@)</label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              className="w-full bg-transparent border-b border-gray-300 dark:border-zinc-700 py-2.5 text-[17px] text-black dark:text-white placeholder-gray-400 outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {/* О себе */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 ml-1">О себе</label>
            <textarea
              rows={2}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Немного о вас..."
              className="w-full bg-transparent border-b border-gray-300 dark:border-zinc-700 py-2.5 text-[15px] text-black dark:text-white placeholder-gray-400 outline-none focus:border-black dark:focus:border-white transition-colors resize-none"
            />
          </div>

          {/* Личный канал */}
          <div className="pt-2">
            <div className="flex items-center justify-between border-b border-gray-300 dark:border-zinc-700 pb-2.5 group">
              <div className="flex flex-col flex-1">
                <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Канал</label>
                <div className="flex items-center gap-3">
                  <Volume2 size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={personalChannel}
                    onChange={e => setPersonalChannel(e.target.value)}
                    placeholder="Ссылка на ваш канал"
                    className="bg-transparent text-[16px] text-black dark:text-white placeholder-gray-400 outline-none w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* День рождения */}
          <div className="pt-2">
            <div className="flex items-center justify-between border-b border-gray-300 dark:border-zinc-700 pb-2.5 group">
              <div className="flex flex-col flex-1 relative">
                <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">День рождения</label>
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="bg-transparent text-[16px] text-black dark:text-white placeholder-gray-400 outline-none w-full"
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 ml-1">Дата вашего рождения будет видна в вашем профиле.</p>
          </div>

          {/* Пароль */}
          <div className="pt-4">
            {!isChangingPassword ? (
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="text-[15px] font-medium text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-3 w-full active:scale-95 transition-all"
              >
                Изменить пароль
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-900 rounded-xl p-3 border border-gray-200 dark:border-zinc-800">
                <input
                  autoFocus
                  type="password"
                  placeholder="Новый пароль"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="flex-1 bg-transparent border-none text-[15px] text-black dark:text-white outline-none"
                />
                <button onClick={() => { setIsChangingPassword(false); setNewPassword(''); }} className="p-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Плавающая кнопка сохранения */}
      <div className="fixed bottom-6 left-0 w-full px-6 flex justify-center pointer-events-none">
        <button
          onClick={() => handleSave()}
          disabled={isSaving || isUploading}
          className="w-full max-w-sm py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center pointer-events-auto"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Сохранить изменения'}
        </button>
      </div>

    </div>
  );
        }
