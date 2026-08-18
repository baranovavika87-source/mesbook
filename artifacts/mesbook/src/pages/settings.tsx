import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageSquare, User, Settings as SettingsIcon, LogOut, Check, Moon, Sun } from 'lucide-react';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Проверяем текущую тему (чтобы луна/солнце отображались правильно)
    if (localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark')) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    const fetchUser = async () => {
      const storedUser = localStorage.getItem("mesbook_user");
      const userId = storedUser ? JSON.parse(storedUser).id : 1;
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDisplayName(data.displayName || '');
          setUsername(data.username?.replace('@', '') || '');
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Функция переключения темы
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedUser = localStorage.getItem("mesbook_user");
    const userId = storedUser ? JSON.parse(storedUser).id : 1;

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}` 
        },
        body: JSON.stringify({ 
          displayName, 
          username: username ? `@${username}` : undefined,
          password: password || undefined 
        })
      });
      
      if (res.ok) {
        setSaved(true);
        setPassword('');
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {}
  };

  const handleLogout = () => {
    localStorage.removeItem("mesbook_user");
    window.location.href = "/";
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950 transition-colors duration-300">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Профиль</h1>
        {/* Кнопка смены темы */}
        <button onClick={toggleTheme} className="p-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 active:scale-90 transition-all">
          {isDark ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6">
        <div className="flex justify-center my-6">
          <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-4xl shadow-sm border border-transparent dark:border-blue-800/50">
            {displayName ? displayName.charAt(0).toUpperCase() : "U"}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5 ml-1">Имя в чате</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5 ml-1">Никнейм (@)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5 ml-1">Сменить пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Оставьте пустым, если не меняете"
              className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-500 text-white font-bold rounded-xl py-4 active:scale-95 transition shadow-sm"
          >
            {saved ? <><Check size={20} /> Сохранено</> : "Сохранить изменения"}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full mt-8 mb-8 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 font-bold rounded-xl py-4 active:scale-95 transition"
        >
          <LogOut size={20} /> Выйти из аккаунта
        </button>
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 dark:border-gray-900 flex justify-around p-4 bg-white dark:bg-gray-950 mt-auto transition-colors duration-300">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-blue-600 dark:text-blue-500">
            <SettingsIcon size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}

