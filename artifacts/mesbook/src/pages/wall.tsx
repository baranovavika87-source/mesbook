import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2 } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = getUserId();

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wall/feed', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (res.ok) setPosts(await res.json());
    } catch (e) {}
    setIsLoading(false);
  };

  useEffect(() => { loadFeed(); }, []);

  const parsePostContent = (content: string) => {
    const mediaUrls: string[] = [];
    const mediaRegex = /\[MEDIA\]\s*(https?:\/\/[^\s]+)/g;
    let match;
    let text = content;
    while ((match = mediaRegex.exec(content)) !== null) mediaUrls.push(match[1]);
    text = text.replace(mediaRegex, '').trim();
    return { text, mediaUrls };
  };

  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 font-sans">
      
      {/* ШАПКА В СТИЛЕ iOS */}
      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-[#f2f2f7]/90 dark:bg-black/90 sticky top-0 z-10 border-b border-gray-200/50 dark:border-zinc-900/50 shadow-sm backdrop-blur-md">
        <button onClick={loadFeed} className="text-black dark:text-white text-[16px] font-medium active:scale-95 transition-all ml-1">Обновить</button>
        <h1 className="text-black dark:text-white text-[20px] font-semibold absolute left-1/2 -translate-x-1/2 tracking-wide">Стена</h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto pt-4 pb-20 px-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-20"><Loader2 size={32} className="animate-spin text-gray-400 dark:text-zinc-600" /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-[#1c1c1e] rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-zinc-800/50">
              <Users size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-[15px] max-w-[250px] leading-relaxed">
              Здесь будут новые записи из каналов, на которые вы подписаны.
            </p>
            <Link href="/">
              <a className="mt-8 px-8 py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-2xl active:scale-95 transition-transform text-[15px] shadow-md">
                Найти каналы
              </a>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col space-y-5">
            {posts.map((post) => {
              const { text, mediaUrls } = parsePostContent(post.content);
              return (
                <div key={post.id} className="bg-white dark:bg-[#1c1c1e] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800/50">
                  
                  {/* ИМЯ КАНАЛА И ВРЕМЯ */}
                  <div className="px-5 py-3.5 border-b border-gray-100/50 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-[#1c1c1e]">
                    <span className="text-black dark:text-white font-semibold text-[16px] truncate">{post.channelName}</span>
                    <span className="text-gray-400 text-[12px] shrink-0 font-medium">{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  {/* МЕДИА СЕТКА */}
                  {mediaUrls.length > 0 && (
                    <div className={`grid gap-0.5 bg-gray-200 dark:bg-black ${mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {mediaUrls.map((url, idx) => (
                        <div key={idx} className="w-full aspect-square bg-gray-100 dark:bg-zinc-900 relative">
                          {url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/') ? (
                            <video src={url} controls className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                            <img src={url} alt="Media" className="w-full h-full object-cover absolute inset-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ТЕКСТ ПОСТА */}
                  {text && (
                    <div className="p-5">
                      <p className="text-black dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap">{text}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav className="border-t border-gray-200/50 dark:border-zinc-800/50 flex justify-around p-3 bg-[#f2f2f7]/80 dark:bg-black/80 backdrop-blur-md z-10 pb-6">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <MessageSquare size={26} className="mb-1" />
            <span className="text-[10px] font-medium">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-black dark:text-white">
            <Users size={26} className="mb-1" fill="currentColor" />
            <span className="text-[10px] font-medium">Стена</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
