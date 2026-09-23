import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2, Edit2, Trash2, X } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

const translations = {
  ru: {
    wall: "Стена",
    refresh: "Обновить",
    emptyDesc: "Здесь будут новые записи из каналов, на которые вы подписаны.",
    findChannels: "Найти каналы",
    chats: "Чаты",
    edited: "изменено",
    deleteConfirm: "Удалить запись?",
    editPost: "Редактировать запись",
    save: "Сохранить",
    cancel: "Отмена"
  },
  en: {
    wall: "Wall",
    refresh: "Refresh",
    emptyDesc: "New posts from the channels you are subscribed to will appear here.",
    findChannels: "Find Channels",
    chats: "Chats",
    edited: "edited",
    deleteConfirm: "Delete post?",
    editPost: "Edit post",
    save: "Save",
    cancel: "Cancel"
  }
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = getUserId();
  
  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  // СОСТОЯНИЯ ДЛЯ РЕДАКТИРОВАНИЯ
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");

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

  const startEditingPost = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content);
  };

  const saveEditedPost = async () => {
    if (!editContent.trim()) return;
    try {
      await fetch(`/api/chats/${editingPost.chatId}/messages/${editingPost.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
         body: JSON.stringify({ content: editContent })
      });
      loadFeed();
    } catch(e) {}
    setEditingPost(null);
  };

  const deletePost = async (post: any) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await fetch(`/api/chats/${post.chatId}/messages/${post.id}`, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      loadFeed();
    } catch (e) {}
  };

  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 font-sans relative">
      
      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-[#f2f2f7]/90 dark:bg-black/90 sticky top-0 z-10 border-b border-gray-200/50 dark:border-zinc-900/50 shadow-sm backdrop-blur-md">
        <button onClick={loadFeed} className="text-black dark:text-white text-[16px] font-medium active:scale-95 transition-all ml-1">{t.refresh}</button>
        <h1 className="text-black dark:text-white text-[20px] font-semibold absolute left-1/2 -translate-x-1/2 tracking-wide">{t.wall}</h1>
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
              {t.emptyDesc}
            </p>
            <Link href="/">
              <a className="mt-8 px-8 py-3.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-2xl active:scale-95 transition-transform text-[15px] shadow-md">
                {t.findChannels}
              </a>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col space-y-5">
            {posts.map((post) => {
              const { text, mediaUrls } = parsePostContent(post.content);
              return (
                <div key={post.id} className="bg-white dark:bg-[#1c1c1e] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800/50">
                  
                  <div className="px-5 py-3.5 border-b border-gray-100/50 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-[#1c1c1e]">
                    <span className="text-black dark:text-white font-semibold text-[16px] truncate">{post.channelName}</span>
                    <div className="flex items-center gap-2">
                      {post.isEdited && <span className="text-[10px] text-gray-400 italic font-medium">{t.edited}</span>}
                      <span className="text-gray-400 text-[12px] shrink-0 font-medium">{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {post.isMine && (
                        <div className="flex items-center gap-2 ml-2 border-l border-gray-200 dark:border-zinc-700 pl-3">
                          <button onClick={() => startEditingPost(post)} className="text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => deletePost(post)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  
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

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ ЗАПИСИ НА СТЕНЕ */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[24px] overflow-hidden shadow-xl border border-gray-100/50 dark:border-zinc-800/50">
            <div className="px-5 py-4 border-b border-gray-100/50 dark:border-zinc-800/50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-black dark:text-white">{t.editPost}</h3>
              <button onClick={() => setEditingPost(null)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <div className="p-5">
              <textarea
                className="w-full bg-[#f2f2f7] dark:bg-black rounded-[16px] p-4 text-[16px] text-black dark:text-white outline-none resize-none border border-gray-200/50 dark:border-zinc-800/50 focus:border-black dark:focus:border-white transition-colors"
                rows={5}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 dark:bg-[#1c1c1e] flex gap-3">
              <button onClick={() => setEditingPost(null)} className="flex-1 py-3.5 font-semibold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded-[16px] active:scale-95 transition-transform">{t.cancel}</button>
              <button onClick={saveEditedPost} className="flex-1 py-3.5 font-semibold text-white bg-black dark:bg-white dark:text-black rounded-[16px] active:scale-95 transition-transform shadow-sm">{t.save}</button>
            </div>
          </div>
        </div>
      )}

      <nav className="border-t border-gray-200/50 dark:border-zinc-800/50 flex justify-around p-3 bg-[#f2f2f7]/80 dark:bg-black/80 backdrop-blur-md z-10 pb-6">
        <Link href="/">
          <a className="flex flex-col items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <MessageSquare size={26} className="mb-1" />
            <span className="text-[10px] font-medium">{t.chats}</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-black dark:text-white">
            <Users size={26} className="mb-1" fill="currentColor" />
            <span className="text-[10px] font-medium">{t.wall}</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
