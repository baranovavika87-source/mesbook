import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageSquare, LogOut, Check, Users, Camera, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const savedUser = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
  const [displayName, setDisplayName] = useState(savedUser.displayName || '');
  const [username, setUsername] = useState(savedUser.username || '');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState(savedUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(savedUser.avatarUrl || '');
  const [saved, setSaved] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const fetchUser = async () => {
      const storedUser = localStorage.getItem("mesbook_user");
      const userId = storedUser ? JSON.parse(storedUser).id : 1;
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': 'Bearer ' + userId }
        });
        if (res.ok) {
          const data = await res.json();
          setDisplayName(data.displayName || '');
          setUsername(data.username?.replace('@', '') || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || '');
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

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
        let url = data.secure_url;
        if (url.match(/\.(heic|heif)$/i)) {
          url = url.replace(/\.(heic|heif)$/i, '.jpg');
        }
        setAvatarUrl(url);
        setImgError(false);
      } else {
        alert("Ошибка при загрузке фото");
      }
    } catch (err) {
      alert("Ошибка сети при загрузке");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedUser = localStorage.getItem("mesbook_user");
    const userId = storedUser ? JSON.parse(storedUser).id : 1;

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + userId
        },
        body: JSON.stringify({
          displayName,
          username: username ? '@' + username.replace('@', '') : undefined,
          password: password || undefined,
          bio,
          avatarUrl
        })
      });

      if (res.ok) {
        setSaved(true);
        setPassword("");
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          userObj.avatarUrl = avatarUrl;
          localStorage.setItem("mesbook_user", JSON.stringify(userObj));
        }
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {}
  };

  const handleLogout = () => {
    localStorage.removeItem("mesbook_user");
    window.location.href = "/";
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300">
      
      {/* Шапка: заголовок строго по центру, кнопка темы удалена */}
      <header className="px-6 pt-10 pb-4 relative flex justify-center items-center">
        <h1 className="text-xl font-bold text-black dark:text-white tracking-tight">Профиль</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6">
        <div className="flex justify-center my-6 relative">
          <input 
            type="file" 
            accept="image/*" 
            id="avatar-upload" 
            className="hidden" 
            onChange={handleAvatarUpload}
            disabled={isUploading}
          />
          <label htmlFor="avatar-upload" className={`cursor-pointer relative block group ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white text-4xl font-semibold mb-2 overflow-hidden border-4 border-white dark:border-zinc-800 shadow-sm transition-opacity group-active:opacity-70">
              {avatarUrl && avatarUrl.length > 5 && !imgError ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)} 
                />
              ) : (
                displayName ? displayName.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <div className="absolute bottom-2 right-0 bg-black dark:bg-white text-white dark:text-black rounded-full p-2 shadow-md flex items-center justify-center w-8 h-8">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </div>
          </label>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1.5 ml-1 tracking-wider">Имя в чате</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Как вас зовут?"
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1.5 ml-1 tracking-wider">Никнейм (@)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1.5 ml-1 tracking-wider">О себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Напишите пару слов о себе..."
              rows={3}
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1.5 ml-1 tracking-wider">Сменить пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Оставьте пустым, если не меняете"
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black font-semibold py-3.5 rounded-xl transition-transform active:scale-95 disabled:opacity-50"
          >
            {saved ? <><Check size={20} /> Сохранено</> : "Сохранить изменения"}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full mt-6 mb-10 flex items-center justify-center gap-2 bg-transparent border-2 border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900 text-black dark:text-white font-medium py-3.5 rounded-xl transition-all active:scale-95"
        >
          <LogOut size={20} /> Выйти из аккаунта
        </button>
      </main>

      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black z-10">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
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

