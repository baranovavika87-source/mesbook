import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, User, Settings, Send } from 'lucide-react';

const SafeAvatar = ({ name, url }: { name: string, url?: string }) => {
  return (
    <div className="relative inline-block shrink-0">
      {url && url.length > 5 ? (
        <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-800" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase border border-transparent dark:border-blue-800/50">
          {name ? name.charAt(0) : "U"}
        </div>
      )}
    </div>
  );
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');

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

    const storedUser = localStorage.getItem("mesbook_user");
    const userId = storedUser ? JSON.parse(storedUser).id : 1;

    try {
      const res = await fetch('/api/wall/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        setContent('');
        loadPosts();
      }
    } catch (error) {}
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950 transition-colors duration-300">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Стена</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500">Глобальная лента сообщений</p>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Форма создания поста */}
        <div className="px-6 pb-6 border-b border-gray-100 dark:border-gray-800/50">
          <form onSubmit={handlePost} className="flex gap-2">
            <input
              type="text"
              placeholder="Что у вас нового?"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="rounded-xl bg-blue-600 dark:bg-blue-500 px-4 flex items-center justify-center text-white disabled:opacity-40 transition active:scale-95 shadow-sm"
            >
              <Send size={18} />
            </button>
          </form>
        </div>

        {/* Список постов */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {posts.map((post: any) => (
            <div key={post.id} className="px-6 py-5 hover:bg-gray-50 dark:hover:bg-gray-900 transition">
              <div className="flex items-center gap-3 mb-3">
                <SafeAvatar name={post.author?.displayName || 'U'} url={post.author?.avatarUrl} />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {post.author?.displayName || "Пользователь"}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(post.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{post.content}</p>
            </div>
          ))}
          
          {posts.length === 0 && (
            <div className="text-center py-10 text-gray-400 dark:text-gray-600">
              <p>Постов пока нет. Напишите первым!</p>
            </div>
          )}
        </div>
      </main>

      {/* Нижняя навигация */}
      <nav className="border-t border-gray-100 dark:border-gray-900 flex justify-around p-4 bg-white dark:bg-gray-950 transition-colors duration-300">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-blue-600 dark:text-blue-500">
            <User size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 transition">
            <Settings size={24} />
            <span className="text-[10px] font-medium mt-1">Настройки</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
