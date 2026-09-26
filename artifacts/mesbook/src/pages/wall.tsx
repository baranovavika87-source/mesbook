import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2, Edit2, Trash2, X, MessageCircle, Smile, Send } from 'lucide-react';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    return u.id || u.userId || u._id || 1;
  } catch (e) { return 1; }
};

const FAST_REACTIONS = ['❤️', '👍', '🔥', '😂', '😢'];

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
    cancel: "Отмена",
    comments: "Комментарии",
    noComments: "Пока нет комментариев",
    commentPlaceholder: "Комментарий..."
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
    cancel: "Cancel",
    comments: "Comments",
    noComments: "No comments yet",
    commentPlaceholder: "Comment..."
  }
};

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = getUserId();
  
  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");

  const [activeReactionMsg, setActiveReactionMsg] = useState<number | null>(null);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wall/feed', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (res.ok) setPosts(await res.json());
    } catch (e) {}
    setIsLoading(false);
  };

  const loadComments = async (chatId: number, messageId: number) => {
     try {
       const commRes = await fetch(`/api/chats/${chatId}/messages/${messageId}/comments`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
       if (commRes.ok) setThreadComments(await commRes.json());
     } catch(e) {}
  };

  useEffect(() => { loadFeed(); }, []);

  useEffect(() => {
    if (activeThread) loadComments(activeThread.chatId, activeThread.id);
  }, [activeThread]);

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

  const toggleReaction = async (post: any, reaction: string) => {
    try {
      await fetch(`/api/chats/${post.chatId}/messages/${post.id}/reaction`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
        body: JSON.stringify({ reaction }) 
      });
      loadFeed();
    } catch (e) {}
    setActiveReactionMsg(null);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !activeThread) return;
    const txt = commentContent.trim();
    setCommentContent('');
    try {
      await fetch(`/api/chats/${activeThread.chatId}/messages`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
        body: JSON.stringify({ content: txt, parentId: activeThread.id }) 
      });
      loadComments(activeThread.chatId, activeThread.id);
      loadFeed();
    } catch (error) {}
  };

  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 font-sans relative overflow-hidden" onClick={() => setActiveReactionMsg(null)}>
      
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
              const reactionsKeys = post.reactions ? Object.keys(post.reactions) : [];

              return (
                <div key={post.id} className="bg-white dark:bg-[#1c1c1e] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800/50">
                  
                  <div className="px-5 py-3.5 border-b border-gray-100/50 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-[#1c1c1e]">
                    <span className="text-black dark:text-white font-semibold text-[16px] truncate">{post.channelName}</span>
                    <div className="flex items-center gap-2">
                      {post.isEdited && <span className="text-[10px] text-gray-400 italic font-medium">{t.edited}</span>}
                      <span className="text-gray-400 text-[12px] shrink-0 font-medium">{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {post.isMine && (
                        <div className="flex items-center gap-2 ml-2 border-l border-gray-200 dark:border-zinc-700 pl-3">
                          <button onClick={() => startEditingPost(post)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => deletePost(post)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Trash2 size={16} /></button>
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
                    <div className="px-5 pt-4 pb-2">
                      <p className="text-black dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap">{text}</p>
                    </div>
                  )}

                  {/* ПОДВАЛ ПОСТА: Реакции и кнопка комментариев */}
                  <div className="px-5 pb-4 pt-2 flex flex-col gap-3 relative">
                    
                    {/* Список поставленных реакций */}
                    {reactionsKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reactionsKeys.map(key => (
                           <button 
                             key={key} 
                             onClick={(e) => { e.stopPropagation(); toggleReaction(post, key); }}
                             className={`flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-bold border transition-colors ${post.myReaction === key ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700'}`}
                           >
                             <span>{key}</span>
                             <span>{post.reactions[key]}</span>
                           </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-100/50 dark:border-zinc-800/50 pt-3">
                      <button 
                        onClick={() => { setActiveThread(post); setThreadComments([]); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-[12px] font-bold text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
                      >
                        <MessageCircle size={14} />
                        {post.commentsCount > 0 ? `${post.commentsCount} ${t.comments}` : t.comments}
                      </button>

                      <div className="relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveReactionMsg(activeReactionMsg === post.id ? null : post.id); }} 
                          className="text-gray-400 hover:text-black dark:hover:text-white transition-colors p-1"
                        >
                          <Smile size={20} />
                        </button>
                        
                        {/* Панель выбора реакций */}
                        {activeReactionMsg === post.id && (
                          <div className="absolute z-50 flex gap-2 p-2 bg-white dark:bg-[#1c1c1e] rounded-full shadow-lg border border-gray-200/50 dark:border-zinc-800 right-0 bottom-8">
                             {FAST_REACTIONS.map(emoji => (
                               <button 
                                 key={emoji} 
                                 onClick={(e) => { e.stopPropagation(); toggleReaction(post, emoji); }}
                                 className="w-8 h-8 flex items-center justify-center text-[20px] hover:scale-125 transition-transform active:scale-95"
                               >
                                 {emoji}
                               </button>
                             ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* МОДАЛКА КОММЕНТАРИЕВ ДЛЯ СТЕНЫ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f2f2f7] dark:bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-200/50 dark:border-zinc-900 bg-[#f2f2f7]/90 dark:bg-black/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-black dark:text-white transition-colors active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-black dark:text-white">{t.comments}</h1>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] shadow-sm mb-2 border border-gray-100/50 dark:border-zinc-800">
              <span className="font-semibold text-[14px] text-gray-500 mb-1 block">{activeThread.channelName}</span>
              <p className="text-[15px] text-black dark:text-white whitespace-pre-wrap">{parsePostContent(activeThread.content).text}</p>
            </div>
            
            {threadComments.length === 0 ? (
               <div className="text-center text-gray-400 dark:text-zinc-600 mt-10 font-medium">{t.noComments}</div>
            ) : (
               threadComments.map(c => (
                 <div key={c.id} className="flex gap-3 items-start">
                   <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden text-[12px] font-medium border border-gray-300/30 dark:border-zinc-700 text-black dark:text-white">
                     {c.senderAvatar ? <img src={c.senderAvatar} className="w-full h-full object-cover" /> : c.senderName.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex flex-col flex-1 bg-white dark:bg-[#1c1c1e] p-3 rounded-[16px] rounded-tl-none shadow-sm border border-gray-100/50 dark:border-zinc-800">
                     <span className="text-[12px] font-bold mb-1 text-black dark:text-white">{c.senderName}</span>
                     <span className="text-[14px] text-black dark:text-white whitespace-pre-wrap leading-snug">{c.content}</span>
                     <span className="text-[10px] text-gray-400 mt-1 text-right">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                 </div>
               ))
            )}
          </div>
          
          <form onSubmit={handleSendComment} className="p-3 bg-[#f2f2f7] dark:bg-black border-t border-gray-200/50 dark:border-zinc-900/50 flex items-center gap-2 pb-6">
            <input 
              className="flex-1 bg-white dark:bg-[#1c1c1e] border border-gray-200/50 dark:border-zinc-800 rounded-full px-5 py-2.5 outline-none text-black dark:text-white placeholder-gray-400 text-[15px] shadow-sm focus:border-black dark:focus:border-white" 
              value={commentContent} 
              onChange={e => setCommentContent(e.target.value)} 
              placeholder={t.commentPlaceholder} 
            />
            <button type="submit" disabled={!commentContent.trim()} className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95 shadow-sm">
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      )}

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ */}
      {editingPost && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
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
