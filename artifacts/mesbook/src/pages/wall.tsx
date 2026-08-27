import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Sparkles, Loader2 } from 'lucide-react';

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
    <div className="flex h-screen flex-col bg-[#0a0a0a] transition-colors duration-300">
      
      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-[#1c1c1e] sticky top-0 z-10 border-b border-white/5 shadow-md">
        <button 
          onClick={loadFeed} 
          className="text-[#5a98d0] text-[17px] font-medium active:opacity-70 transition-opacity"
        >
          Обновить
        </button>
        <h1 className="text-white text-[18px] font-semibold absolute left-1/2 -translate-x-1/2">
          Стена
        </h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto bg-[#0a0a0a] pt-4 pb-20">
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-[#5a98d0]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <Sparkles size={48} className="text-gray-600 mb-4 opacity-50" />
            <p className="text-gray-400 text-base">
              Здесь будут появляться новые записи из каналов, на которые вы подписаны.
            </p>
            <Link href="/">
              <a className="mt-6 px-6 py-3 bg-[#1c1c1e] text-[#5a98d0] font-medium rounded-xl border border-white/5 active:scale-95 transition-transform">
                Найти каналы
              </a>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col space-y-5 px-2">
            {posts.map((post) => {
              const { text, mediaUrls } = parsePostContent(post.content);
              
              return (
                <div key={post.id} className="bg-[#1c1c1e] rounded-[22px] overflow-hidden shadow-sm">
                  
                  <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[#5a98d0] font-semibold text-[16px] tracking-wide truncate pr-2">
                      {post.channelName}
                    </span>
                    <span className="text-gray-500 text-[11px] shrink-0">
                      {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Сетка для медиафайлов от края до края */}
                  {mediaUrls.length > 0 && (
                    <div className={`grid gap-0.5 bg-black ${mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {mediaUrls.map((url, idx) => (
                        <div key={idx} className="w-full aspect-square bg-zinc-900 relative">
                          {url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/') ? (
                            <video src={url} controls className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                            <img src={url} alt="Media" className="w-full h-full object-cover absolute inset-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {text && (
                    <div className="p-4 relative">
                      <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap pr-8">
                        {text}
                      </p>
                      <Sparkles className="absolute right-4 bottom-4 text-white/20" size={22} fill="currentColor" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav className="border-t border-zinc-900/80 flex justify-around p-4 bg-[#1c1c1e] z-10 pb-6">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-500 hover:text-white transition-colors">
            <MessageSquare size={24} />
            <span className="text-[10px] font-medium mt-1">Чаты</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-white transition-colors">
            <Users size={24} />
            <span className="text-[10px] font-medium mt-1">Стена</span>
          </a>
        </Link>
      </nav>
    </div>
  );
                                                             }
