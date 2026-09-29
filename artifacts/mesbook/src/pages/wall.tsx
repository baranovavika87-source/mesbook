import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2, Edit2, Trash2, X, MessageCircle, Smile, Send, ArrowLeft, Download, Copy, Reply } from 'lucide-react';
import { io } from 'socket.io-client';

let socket: any = null;

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
    commentPlaceholder: "Комментарий...",
    commentsCount: ['комментарий', 'комментария', 'комментариев'],
    replyAction: "Ответить",
    copy: "Копировать",
    editAction: "Изменить",
    deleteAction: "Удалить"
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
    commentPlaceholder: "Comment...",
    commentsCount: ['comment', 'comments', 'comments'],
    replyAction: "Reply",
    copy: "Copy",
    editAction: "Edit",
    deleteAction: "Delete"
  }
};

function declOfNum(n: number, text_forms: string[], lang: 'ru' | 'en') {
  n = Math.abs(n) % 100;
  if (lang === 'en') return n === 1 ? text_forms[0] : text_forms[1];
  const n1 = n % 10;
  if (n > 10 && n < 20) return text_forms[2];
  if (n1 > 1 && n1 < 5) return text_forms[1];
  if (n1 === 1) return text_forms[0];
  return text_forms[2];
}

export default function WallPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = getUserId();
  
  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");

  const [activeReactionMsg, setActiveReactionMsg] = useState<number | null>(null);
  const [activeContextMenu, setActiveContextMenu] = useState<number | null>(null);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const activeThreadRef = useRef<any>(null);
  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  const loadFeed = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch('/api/wall/feed', { headers: { 'Authorization': 'Bearer ' + currentUserId } });
      if (res.ok) setPosts(await res.json());
    } catch (e) {}
    if (!silent) setIsLoading(false);
  };

  const loadComments = async (chatId: number, messageId: number) => {
     try {
       const commRes = await fetch(`/api/chats/${chatId}/messages/${messageId}/comments`, { headers: { 'Authorization': 'Bearer ' + currentUserId } });
       if (commRes.ok) setThreadComments(await commRes.json());
     } catch(e) {}
  };

  useEffect(() => {
    loadFeed();
    if (!socket) socket = io(window.location.origin, { path: '/socket.io' });
    
    const handleUpdate = () => {
      loadFeed(true);
      if (activeThreadRef.current) {
        loadComments(activeThreadRef.current.chatId, activeThreadRef.current.id);
      }
    };

    socket.on('global_update', handleUpdate);
    socket.on('wall:post', handleUpdate);

    const interval = setInterval(handleUpdate, 15000);
    return () => {
      clearInterval(interval);
      socket.off('global_update', handleUpdate);
      socket.off('wall:post', handleUpdate);
    };
  }, [currentUserId]);

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
      loadFeed(true);
    } catch(e) {}
    setEditingPost(null);
  };

  const deletePost = async (post: any) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await fetch(`/api/chats/${post.chatId}/messages/${post.id}`, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      loadFeed(true);
    } catch (e) {}
  };

  const toggleReaction = async (post: any, reaction: string) => {
    try {
      await fetch(`/api/chats/${post.chatId}/messages/${post.id}/reaction`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
        body: JSON.stringify({ reaction }) 
      });
    } catch (e) {}
    setActiveReactionMsg(null);
    setActiveContextMenu(null);
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
    } catch (error) {}
  };

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `mesogram_photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (e) { window.open(url, '_blank'); }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f2f2f7] dark:bg-black transition-colors duration-300 font-sans relative overflow-hidden" onClick={() => { setActiveReactionMsg(null); setActiveContextMenu(null); }}>
      
      {/* ЛАЙТБОКС */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-10">
            <button onClick={() => setFullScreenImage(null)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><X size={24} /></button>
            <button onClick={() => downloadImage(fullScreenImage)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><Download size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden touch-pinch-zoom">
            <img src={fullScreenImage} alt="Fullscreen Media" className="max-w-full max-h-full object-contain select-none" />
          </div>
        </div>
      )}

      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-[#f2f2f7]/90 dark:bg-black/90 sticky top-0 z-10 border-b border-gray-200/50 dark:border-zinc-900/50 shadow-sm backdrop-blur-md">
        <button onClick={() => loadFeed(false)} className="text-black dark:text-white text-[16px] font-medium active:scale-95 transition-all ml-1">{t.refresh}</button>
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
              const isMenuOpen = activeContextMenu === post.id;
              const isMe = String(post.senderId) === String(currentUserId);

              return (
                <div 
                  key={post.id} 
                  className={`bg-white dark:bg-[#1c1c1e] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800/50 relative ${isMenuOpen ? 'z-50' : 'z-10'}`}
                  onContextMenu={(e) => { e.preventDefault(); setActiveContextMenu(post.id); }}
                  onTouchStart={(e) => { 
                    pressTimer.current = setTimeout(() => {
                      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
                      setActiveContextMenu(post.id);
                    }, 400); 
                  }}
                  onTouchMove={() => {
                    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
                  }}
                  onTouchEnd={() => { 
                    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
                  }}
                >
                  
                  <div className="px-5 py-3.5 border-b border-gray-100/50 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-[#1c1c1e]">
                    <span className="text-black dark:text-white font-semibold text-[16px] truncate">{post.channelName}</span>
                    <div className="flex items-center gap-2">
                      {post.isEdited && <span className="text-[10px] text-gray-400 italic font-medium">{t.edited}</span>}
                      <span className="text-gray-400 text-[12px] shrink-0 font-medium">{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  
                  {mediaUrls.length > 0 && (
                    <div className={`grid gap-0.5 bg-gray-200 dark:bg-black ${mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {mediaUrls.map((url, idx) => (
                        <div key={idx} className="w-full aspect-square bg-gray-100 dark:bg-zinc-900 relative">
                          {url.match(/\.(mp4|webm|mov|ogg)$/i) || url.includes('/video/upload/') ? (
                            <video src={url} controls className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                            <img onClick={() => setFullScreenImage(url)} src={url} alt="Media" className="w-full h-full object-cover absolute inset-0 cursor-pointer" />
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

                  <div className="px-5 pb-4 pt-2 flex flex-col gap-3 relative">
                    
                    {reactionsKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reactionsKeys.map(key => {
                           const rData = post.reactions[key] || { count: 1, users: [] };
                           return (
                             <button 
                               key={key} 
                               onClick={(e) => { e.stopPropagation(); toggleReaction(post, key); }}
                               className={`flex items-center justify-center gap-1.5 h-[26px] px-2.5 rounded-full border transition-transform hover:scale-105 active:scale-95 ${post.myReaction === key ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md z-10' : 'bg-gray-50 dark:bg-[#1c1c1e] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 shadow-sm'}`}
                             >
                               <span className="text-[14px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                               <span className="text-[12px] font-bold leading-none flex items-center justify-center mt-[1px]">{rData.count}</span>
                             </button>
                           )
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-100/50 dark:border-zinc-800/50 pt-3">
                      <button 
                        onClick={() => { setActiveThread(post); setThreadComments([]); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-[12px] font-bold text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
                      >
                        <MessageCircle size={14} />
                        {post.commentsCount > 0 ? `${post.commentsCount} ${declOfNum(post.commentsCount, t.commentsCount, lang)}` : t.comments}
                      </button>

                      <div className="relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveReactionMsg(activeReactionMsg === post.id ? null : post.id); }} 
                          className="text-gray-400 hover:text-black dark:hover:text-white transition-colors p-1"
                        >
                          <Smile size={20} />
                        </button>
                        
                        {activeReactionMsg === post.id && !isMenuOpen && (
                          <div className="absolute z-50 flex gap-2 p-2 bg-white dark:bg-[#1c1c1e] rounded-full shadow-lg border border-gray-200/50 dark:border-zinc-800 right-0 bottom-8">
                             {FAST_REACTIONS.map(emoji => (
                               <button 
                                 key={emoji} 
                                 onClick={(e) => { e.stopPropagation(); toggleReaction(post, emoji); setActiveReactionMsg(null); }}
                                 className={`w-8 h-8 flex items-center justify-center text-[20px] hover:scale-125 transition-transform active:scale-95 ${post.myReaction === emoji ? 'bg-black/10 dark:bg-white/10' : ''}`}
                               >
                                 {emoji}
                               </button>
                             ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {isMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-[60]" 
                          onClick={(e) => { e.stopPropagation(); setActiveContextMenu(null); }} 
                          onContextMenu={(e) => { e.preventDefault(); setActiveContextMenu(null); }}
                        />
                        <div className="absolute z-[70] flex flex-col gap-2 right-4 bottom-14 min-w-[200px] items-end">
                          <div className="flex gap-1.5 p-2 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl rounded-full shadow-lg border border-gray-200/50 dark:border-zinc-800">
                             {FAST_REACTIONS.map(emoji => (
                               <button 
                                 key={emoji} 
                                 onClick={(e) => { e.stopPropagation(); toggleReaction(post, emoji); setActiveContextMenu(null); }}
                                 className={`w-8 h-8 flex items-center justify-center text-[20px] rounded-full transition-transform hover:scale-125 active:scale-95 ${post.myReaction === emoji ? 'bg-black/10 dark:bg-white/10' : ''}`}
                               >
                                 {emoji}
                               </button>
                             ))}
                          </div>

                          <div className="flex flex-col bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 dark:border-zinc-800 overflow-hidden w-full">
                             <button 
                               onClick={(e) => { e.stopPropagation(); setActiveThread(post); setThreadComments([]); setActiveContextMenu(null); }}
                               className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left border-b border-gray-200/50 dark:border-zinc-800/50"
                             >
                               <Reply size={18} className="text-gray-500 dark:text-gray-400" />
                               {t.replyAction}
                             </button>
                             
                             <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 const textToCopy = parsePostContent(post.content).text;
                                 navigator.clipboard.writeText(textToCopy); 
                                 setActiveContextMenu(null); 
                               }}
                               className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left border-b border-gray-200/50 dark:border-zinc-800/50"
                             >
                               <Copy size={18} className="text-gray-500 dark:text-gray-400" />
                               {t.copy}
                             </button>

                             {isMe && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); startEditingPost(post); setActiveContextMenu(null); }}
                                 className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left border-b border-gray-200/50 dark:border-zinc-800/50"
                               >
                                 <Edit2 size={18} className="text-gray-500 dark:text-gray-400" />
                                 {t.editAction}
                               </button>
                             )}

                             {isMe && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setActiveContextMenu(null); deletePost(post); }}
                                 className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                               >
                                 <Trash2 size={18} className="text-red-500" />
                                 {t.deleteAction}
                               </button>
                             )}
                          </div>
                        </div>
                      </>
                    )}
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
    </div>
  );
}
