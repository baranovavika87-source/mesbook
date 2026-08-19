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
        setPassword("");
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {}
  };

  const handleLogout = () => {
    localStorage.removeItem("mesbook_user");
    window.location.href = "/";
  };

  return (
    // Главный контейнер (сделан полностью черным в dark mode)
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center">
        <h1 className="text-4xl font-extrabold text-black dark:text-white tracking-tight">Профиль</h1>
        {/* Кнопка смены темы */}
        <button onClick={toggleTheme} className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-900 text-black dark:text-white transition-colors">
          {isDark ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6">
        <div className="flex justify-center my-6">
          {/* Аватарка: нейтрально-серая, без синего */}
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white text-4xl font-semibold mb-6">
            {displayName ? displayName.charAt(0).toUpperCase() : "U"}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1.5 ml-1">Имя в чате</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1.5 ml-1">Никнейм (@)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1.5 ml-1">Сменить пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Оставьте пустым, если не меняете"
              className="w-full bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3.5 text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          {/* Главная кнопка: черная в светлой теме, белая в темной */}
          <button
            type="submit"
            className="w-full mt-2 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {saved ? <><Check size={20} /> Сохранено</> : "Сохранить изменения"}
          </button>
        </form>

        {/* Кнопка выхода: прозрачная с рамкой, никаких красных пятен */}
        <button
          onClick={handleLogout}
          className="w-full mt-8 mb-8 flex items-center justify-center gap-2 bg-transparent border border-gray-200 dark:border-zinc-800 text-black dark:text-white font-medium py-3.5 rounded-xl transition-all active:scale-[0.98]"
        >
          <LogOut size={20} /> Выйти из аккаунта
        </button>
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          {/* Активная вкладка: строгий контраст */}
          <a className="flex flex-col items-center text-black dark:text-white transition-colors">
            <SettingsIcon size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
