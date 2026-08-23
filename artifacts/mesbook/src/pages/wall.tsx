import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageSquare, User, Send, Users, X, Moon, Sun, LogOut, Trash2 } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

const SafeAvatar = ({ name, url }: { name: string, url?: string }) => {
  return (
    <div className="relative inline-block shrink-0">
      {url && url.length > 5 ? (
        <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-zinc-800" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center font-semibold text-lg">
          {name ? name.charAt(0).toUpperCase() : "U"}
        </div>
      )}
    </div>
  );
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  
  // Состояния для бокового меню и модалки профиля
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(() => {
  const saved = localStorage.getItem('mesbook_user');
  return saved ? JSON.parse(saved) : null;
});
  const [isDark, setIsDark] = useState(false);
  const [, setLocation] = useLocation();
  const currentUserId = getUserId();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
        if (res.ok) setCurrentUser(await res.json());
      } catch (e) {}
    };
    fetchMe();
  }, [currentUserId]);

  const loadPosts = async () => {
    try {
      const res = await fetch('/api/wall/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadPosts();
    const interval = setInterval(loadPosts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      const res = await fetch('/api/wall/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + currentUserId
        },
        body: JSON.stringify({ content })
      });

      if (res.ok) {
        setContent("");
        loadPosts();
      }
    } catch (error) {}
  };

  const handleDeletePost = async (postId: number) => {
    if (!window.confirm("Удалить этот пост?")) return;
    try {
      const res = await fetch('/api/wall/posts/' + postId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (res.ok) {
        loadPosts();
      }
    } catch (e) {}
  };

  const toggleTheme = () => {
    const isNowDark = document.documentElement.classList.toggle('dark');
    setIsDark(isNowDark);
  };

  const handleLogout = () => {
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300 relative overflow-hidden">
      
      {/* --- БОКОВОЕ МЕНЮ (САЙДБАР) --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={'fixed top-0 left-0 h-full w-[80%] max-w-[320px] bg-white dark:bg-[#0a0a0a] z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ' + (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="p-4 flex justify-end">
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-black dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 transition">
            <X size={26} />
          </button>
        </div>

        <div className="px-6 pb-6 border-b border-gray-100 dark:border-zinc-900 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold text-black dark:text-white mb-4 overflow-hidden">
            {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'
            )}
          </div>
          <h2 className="text-2xl font-bold text-black dark:text-white leading-tight mb-1">
            {currentUser?.displayName || 'Пользователь'}
          </h2>
          <p className="text-gray-500 dark:text-zinc-400">
            {currentUser?.username || '@username'}
          </p>
        </div>

        <div className="flex flex-col py-4">
          <Link href="/settings">
            <a className="flex items-center gap-5 px-8 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
              <User size={24} />
              <span className="text-lg font-medium">Мой профиль</span>
            </a>
          </Link>
          <button onClick={toggleTheme} className="flex items-center gap-5 px-8 py-4 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors w-full text-left">
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
            <span className="text-lg font-medium">Тема</span>
          </button>
        </div>

        <div className="mt-auto mb-6">
          <button onClick={handleLogout} className="flex items-center gap-5 px-8 py-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left">
            <LogOut size={24} />
            <span className="text-lg font-medium">Выйти</span>
          </button>
        </div>
      </div>
      {/* --- КОНЕЦ САЙДБАРА --- */}

      <header className="px-6 pt-10 pb-4 h-24 relative z-10">
        <div className="flex justify-between items-center h-full">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-12 h-12 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white font-bold text-xl transition-transform active:scale-95 overflow-hidden"
          >
            {currentUser?.avatarUrl && currentUser.avatarUrl.length > 5 ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'
            )}
          </button>
          
          <div className="text-right">
            <h1 className="text-4xl font-extrabold text-black dark:text-white tracking-tight leading-tight">Стена</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500">Глобальная лента сообщений</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="px-6 pb-6 border-b border-gray-100 dark:border-zinc-900">
          <form onSubmit={handlePost} className="flex gap-2">
            <input
              type="text"
              placeholder="Что у вас нового?"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 bg-gray-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all placeholder-gray-400 dark:placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 flex items-center justify-center disabled:opacity-40 transition-all active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-zinc-900">
          {posts.map((post: any) => (
            <div key={post.id} className="px-6 py-5 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors relative">
              
              {/* Кнопка удаления поста (только для автора) */}
              {String(post.author?.id) === String(currentUserId) && (
                <button 
                  onClick={() => handleDeletePost(post.id)}
                  className="absolute top-5 right-6 text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {/* Кликабельный блок автора */}
              <div 
                className="flex items-center gap-3 mb-3 cursor-pointer inline-flex" 
                onClick={() => setSelectedUser(post.author)}
              >
                <SafeAvatar name={post.author?.displayName || 'U'} url={post.author?.avatarUrl} />
                <div>
                  <h3 className="font-semibold text-black dark:text-white text-sm hover:underline">
                    {post.author?.displayName || 'Пользователь'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    {new Date(post.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-800 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap pr-6">{post.content}</p>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="text-center py-10 text-gray-400 dark:text-zinc-600">
              <p>Постов пока нет. Напишите первым!</p>
            </div>
          )}
        </div>
      </main>

      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black z-10">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-black dark:text-white transition-colors">
            <Users size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
      </nav>

      {/* --- МОДАЛЬНОЕ ОКНО ПРОФИЛЯ --- */}
      {selectedUser && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-black rounded-full text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="p-8 flex flex-col items-center">
              <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-black flex items-center justify-center text-black dark:text-white text-4xl font-semibold mb-4 overflow-hidden border-4 border-white dark:border-zinc-800 shadow-sm">
                {selectedUser?.avatarUrl && selectedUser.avatarUrl.length > 5 ? (
                  <img src={selectedUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (selectedUser?.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : 'U')
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-black dark:text-white text-center">
                {selectedUser?.displayName || 'Пользователь'}
              </h2>
              
              {selectedUser?.username && (
                <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">{selectedUser.username}</p>
              )}
              
              <div className={`mt-3 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide ${selectedUser?.lastSeen && (Date.now() - selectedUser.lastSeen < 3 * 60 * 1000) ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-black text-gray-500 dark:text-zinc-400'}`}>
                {selectedUser?.lastSeen && (Date.now() - selectedUser.lastSeen < 3 * 60 * 1000)
                  ? 'В сети' 
                  : (selectedUser?.lastSeen ? `Был(а) в ${new Date(selectedUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Недавно')}
              </div>

              {selectedUser?.bio && (
                <div className="mt-8 w-full text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 tracking-wider">О себе</p>
                  <p className="text-black dark:text-white text-sm bg-gray-50 dark:bg-black rounded-2xl p-4 leading-relaxed">
                    {selectedUser.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

