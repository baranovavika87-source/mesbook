import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2 } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) {
    return 1;
  }
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = getUserId();

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wall/feed', {
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch (e) {}
    setIsLoading(false);
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // Функция вытаскивает все ссылки на медиа из текста поста
  const parsePostContent = (content: string) => {
    const mediaUrls: string[] = [];
    const mediaRegex = /\[MEDIA\]\s*(https?:\/\/[^\s]+)/g;
    let match;
    let text = content;
    
    while ((match = mediaRegex.exec(content)) !== null) {
      mediaUrls.push(match[1]);
    }
    text = text.replace(mediaRegex, '').trim();

    return { text, mediaUrls };
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black transition-colors duration-300">
      
      {/* Строгая монохромная шапка */}
      <header className="flex justify-between items-center px-6 pt-12 pb-4 bg-white dark:bg-black sticky top-0 z-10 border-b border-gray-100 dark:border-zinc-900">
        <button 
          onClick={loadFeed} 
          className="text-gray-500 hover:text-black dark:hover:text-white text-[15px] font-medium active:scale-95 transition-all"
        >
          Обновить
        </button>
        <h1 className="text-black dark:text-white text-lg font-bold absolute left-1/2 -translate-x-1/2 uppercase tracking-wide">
          Стена
        </h1>
        <div className="w-[70px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white dark:bg-black pt-4 pb-20">
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-gray-400 dark:text-zinc-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Users size={28} className="text-gray-400 dark:text-zinc-600" />
            </div>
            <p className="text-gray-500 dark:text-zinc-400 text-sm max-w-[250px]">
              Здесь будут появляться новые записи из каналов, на которые вы подписаны.
            </p>
            <Link href="/">
              <a className="mt-8 px-8 py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl active:scale-95 transition-transform text-sm">
                Найти каналы
              </a>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col space-y-6 px-4">
            {posts.map((post) => {
              const { text, mediaUrls } = parsePostContent(post.content);
              
              return (
                <div key={post.id} className="bg-gray-50 dark:bg-zinc-900/30 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800/50">
                  
                  {/* Заголовок канала */}
                  <div className="px-4 py-3 border-b border-gray-200/50 dark:border-zinc-800/50 flex items-center justify-between">
                    <span className="text-black dark:text-white font-semibold text-[15px] truncate pr-2">
                      {post.channelName}
                    </span>
                    <span className="text-gray-400 dark:text-zinc-500 text-[11px] shrink-0 font-medium">
                      {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Сетка для медиафайлов от края до края */}
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

                  {/* Текст поста */}
                  {text && (
                    <div className="p-4">
                      <p className="text-black dark:text-white text-[14px] leading-snug whitespace-pre-wrap">
                        {text}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav className="border-t border-gray-100 dark:border-zinc-900 flex justify-around p-4 bg-white dark:bg-black z-10 pb-6">
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
    </div>
  );
}
