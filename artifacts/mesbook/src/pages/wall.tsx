import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2, Edit2, Trash2, X, MessageCircle, Smile, Send, ArrowLeft, Download, Copy, Reply, Check, ChevronRight } from 'lucide-react';
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
    chats: "Чаты",
    refresh: "Обновить",
    emptyDesc: "Здесь будут новые записи из каналов, на которые вы подписаны.",
    findChannels: "Найти каналы",
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
    chats: "Chats",
    refresh: "Refresh",
    emptyDesc: "New posts from the channels you are subscribed to will appear here.",
    findChannels: "Find Channels",
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

    return () => {
      socket.off('global_update', handleUpdate);
      socket.off('wall:post', handleUpdate);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (activeThread) loadComments(activeThread.chatId, activeThread.id);
  }, [activeThread]);

  const parseContent = (rawText: string) => {
    const mediaUrls: string[] = [];
    const mediaRegex = /\[MEDIA\]\s*(https?:\/\/[^\s]+)/g;
    let match;
    let text = rawText;
    while ((match = mediaRegex.exec(text)) !== null) mediaUrls.push(match[1]);
    text = text.replace(mediaRegex, '').trim();
    
    let quotedText = null;
    if (text.startsWith('> ')) {
      const parts = text.split('\n\n');
      quotedText = parts[0].replace('> ', '');
      if (quotedText.startsWith('[MEDIA]')) quotedText = t.photo;
      text = parts.slice(1).join('\n\n');
    }

    const hasMedia = mediaUrls.length > 0;
    const hasText = !!text || !!quotedText;
    const isVideo = hasMedia && (mediaUrls[0].match(/\.(mp4|webm|mov|ogg)$/i) || mediaUrls[0].includes('/video/upload/'));
    
    return { text, quotedText, mediaUrls, hasMedia, hasText, isVideo };
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
    <div className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans relative overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20" onClick={() => { setActiveReactionMsg(null); setActiveContextMenu(null); }}>
      
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

      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-white/80 dark:bg-[#222224]/80 sticky top-0 z-10 border-b border-black/5 dark:border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl">
        <button onClick={() => loadFeed(false)} className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] font-medium active:scale-95 transition-all ml-1">{t.refresh}</button>
        <h1 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[20px] font-bold absolute left-1/2 -translate-x-1/2 tracking-tight">{t.wall}</h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto pt-4 pb-20 px-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-24"><Loader2 size={32} className="animate-spin text-[#86868b] dark:text-[#98989d]" /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-[#222224] rounded-full flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-black/5 dark:border-white/5">
              <Users size={28} className="text-[#86868b] dark:text-[#98989d]" />
            </div>
            <p className="text-[#86868b] dark:text-[#98989d] text-[15px] font-medium max-w-[250px] leading-relaxed">
              {t.emptyDesc}
            </p>
            <Link href="/">
              <a className="mt-8 px-8 py-3.5 bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] font-semibold rounded-[18px] active:scale-95 transition-transform text-[15px] shadow-[0_4px_15px_rgba(0,0,0,0.1)] dark:shadow-none">
                {t.findChannels}
              </a>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {posts.map((post) => {
              const { text, quotedText, mediaUrls, hasMedia, hasText, isVideo } = parseContent(post.content);
              const reactionsKeys = post.reactions ? Object.keys(post.reactions) : [];
              const isMenuOpen = activeContextMenu === post.id;
              const isMe = String(post.senderId) === String(currentUserId);
              const timeStr = post.createdAt ? new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div 
                  key={post.id} 
                  className={`w-full bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 flex flex-col overflow-hidden relative mb-4 ${isMenuOpen ? 'z-50' : 'z-10'}`}
                  onContextMenu={(e) => { e.preventDefault(); setActiveContextMenu(post.id); }}
                  onTouchStart={(e) => { pressTimer.current = setTimeout(() => { if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40); setActiveContextMenu(post.id); }, 400); }}
                  onTouchMove={() => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } }}
                  onTouchEnd={() => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } }}
                >
                  <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between bg-white dark:bg-[#222224]">
                    <div className="flex items-center gap-3">
                       <div className="w-[36px] h-[36px] bg-[#e5e5ea] dark:bg-[#333336] rounded-full flex items-center justify-center font-bold text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
                         {post.channelName.charAt(0).toUpperCase()}
                       </div>
                       <span className="font-semibold text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{post.channelName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.isEdited && <span className="text-[11px] text-[#86868b] dark:text-[#98989d] italic font-medium">{t.edited}</span>}
                      <span className="text-[#86868b] dark:text-[#98989d] text-[13px] font-medium">{timeStr}</span>
                    </div>
                  </div>
                  
                  {hasMedia && (
                    <div className={`relative w-full overflow-hidden flex justify-center bg-[#f5f5f7] dark:bg-[#161618] ${mediaUrls.length > 1 ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                      {mediaUrls.map((url, idx) => (
                         isVideo 
                           ? <video key={idx} src={url} controls className="w-full h-auto max-h-[400px] object-cover" />
                           : <img key={idx} src={url} loading="lazy" decoding="async" onClick={() => setFullScreenImage(url)} className="w-full h-auto max-h-[400px] object-cover cursor-pointer" onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }} />
                      ))}
                    </div>
                  )}
                  
                  {hasText && (
                    <div className="px-4 pt-3 pb-2.5">
                       {quotedText && (
                         <div className={`mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]`}>{quotedText}</div>
                       )}
                       <div className="text-[16px] leading-[1.35] break-words whitespace-pre-wrap text-[#1d1d1f] dark:text-[#f5f5f7]">
                         {text}
                       </div>
                    </div>
                  )}

                  {reactionsKeys.length > 0 && (
                    <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5">
                       {reactionsKeys.map(key => (
                         <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(post, key); }} className={`flex items-center justify-center gap-1.5 h-[28px] px-3 rounded-full border transition-transform hover:scale-105 active:scale-95 ${post.myReaction === key ? 'bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] border-[#1d1d1f] dark:border-[#f5f5f7] shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'bg-[#f5f5f7] dark:bg-[#333336] text-[#86868b] dark:text-[#98989d] border-black/5 dark:border-white/5 shadow-sm'}`}>
                           <span className="text-[14px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                           <span className="text-[13px] font-bold leading-none flex items-center justify-center mt-[1px]">{post.reactions[key].count}</span>
                         </button>
                       ))}
                    </div>
                  )}

                  <button onClick={() => { setActiveThread(post); setThreadComments([]); }} className="w-full flex items-center justify-between px-4 py-3.5 bg-[#f5f5f7]/50 dark:bg-black/10 border-t border-black/5 dark:border-white/5 transition-colors active:bg-black/[0.02] dark:active:bg-white/[0.02]">
                    <div className="flex gap-2.5 items-center">
                      <MessageCircle size={18} className="text-[#86868b] dark:text-[#98989d]" />
                      <span className="text-[14px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {post.commentsCount > 0 ? `${post.commentsCount} ${declOfNum(post.commentsCount, t.commentsCount, lang)}` : t.comments}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-[#86868b] dark:text-[#98989d]" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setActiveContextMenu(null); }} onContextMenu={(e) => { e.preventDefault(); setActiveContextMenu(null); }} />
                      <div className="absolute z-[70] flex flex-col gap-2 right-4 bottom-14 min-w-[200px] items-end">
                        <div className="flex gap-1.5 p-2 bg-white/90 dark:bg-[#222224]/90 backdrop-blur-xl rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-black/5 dark:border-white/5">
                           {FAST_REACTIONS.map(emoji => (
                             <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(post, emoji); setActiveContextMenu(null); }} className={`w-8 h-8 flex items-center justify-center text-[20px] rounded-full transition-transform hover:scale-125 active:scale-95 ${post.myReaction === emoji ? 'bg-black/5 dark:bg-white/10' : ''}`}>
                               {emoji}
                             </button>
                           ))}
                        </div>
                        <div className="flex flex-col bg-white/90 dark:bg-[#222224]/90 backdrop-blur-xl rounded-[20px] shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-black/5 dark:border-white/5 overflow-hidden w-full">
                           <button onClick={(e) => { e.stopPropagation(); setActiveThread(post); setThreadComments([]); setActiveContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left border-b border-black/5 dark:border-white/5">
                             <Reply size={18} className="text-[#86868b] dark:text-[#98989d]" /> {t.replyAction}
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(parseContent(post.content).text); setActiveContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left border-b border-black/5 dark:border-white/5">
                             <Copy size={18} className="text-[#86868b] dark:text-[#98989d]" /> {t.copy}
                           </button>
                           {isMe && (
                             <button onClick={(e) => { e.stopPropagation(); startEditingPost(post); setActiveContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left border-b border-black/5 dark:border-white/5">
                               <Edit2 size={18} className="text-[#86868b] dark:text-[#98989d]" /> {t.editAction}
                             </button>
                           )}
                           {isMe && (
                             <button onClick={(e) => { e.stopPropagation(); setActiveContextMenu(null); deletePost(post); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left">
                               <Trash2 size={18} className="text-red-500" /> {t.deleteAction}
                             </button>
                           )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* МОДАЛКА КОММЕНТАРИЕВ ДЛЯ СТЕНЫ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.comments}</h1>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#222224] p-4 rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none mb-2 border border-black/5 dark:border-white/5">
              <span className="font-semibold text-[14px] text-[#86868b] dark:text-[#98989d] mb-1 block">{activeThread.channelName}</span>
              <p className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap">{parseContent(activeThread.content).text}</p>
            </div>
            
            {threadComments.length === 0 ? (
               <div className="text-center text-[#86868b] dark:text-[#98989d] mt-10 font-medium">{t.noComments}</div>
            ) : (
               threadComments.map(c => (
                 <div key={c.id} className="flex gap-3 items-start">
                   <div className="w-9 h-9 rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center shrink-0 overflow-hidden text-[13px] font-medium border border-black/5 dark:border-white/5 text-[#1d1d1f] dark:text-[#f5f5f7]">
                     {c.senderAvatar ? <img src={c.senderAvatar} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : c.senderName.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex flex-col flex-1 bg-white dark:bg-[#222224] p-3 rounded-[18px] rounded-tl-[4px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5">
                     <span className="text-[13px] font-semibold mb-1 text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{c.senderName}</span>
                     <span className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap leading-snug">{c.content}</span>
                     <span className="text-[11px] text-[#86868b] dark:text-[#98989d] mt-1.5 text-right">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                 </div>
               ))
            )}
          </div>
          
          <form onSubmit={handleSendComment} className="p-3 bg-white/80 dark:bg-[#222224]/80 backdrop-blur-xl border-t border-black/5 dark:border-white/5 flex items-center gap-2 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            <input 
              className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-full px-5 py-2.5 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-[15px]" 
              value={commentContent} 
              onChange={e => setCommentContent(e.target.value)} 
              placeholder={t.commentPlaceholder} 
            />
            <button type="submit" disabled={!commentContent.trim()} className="w-[42px] h-[42px] rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none">
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      )}

      {/* НИЖНЯЯ ПАНЕЛЬ СТЕНЫ С РАЗМЫТИЕМ */}
      <nav className="border-t border-black/[0.05] dark:border-white/[0.05] flex justify-around p-3 bg-white/80 dark:bg-[#222224]/80 backdrop-blur-xl z-10 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <Link href="/">
          <a className="flex flex-col items-center text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors active:scale-95">
            <MessageSquare size={26} className="mb-1" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide">{t.chats}</span>
          </a>
        </Link>
        <Link href="/wall">
          <a className="flex flex-col items-center text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95">
            <Users size={26} className="mb-1" fill="currentColor" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide">{t.wall}</span>
          </a>
        </Link>
      </nav>
    </div>
  );
}
