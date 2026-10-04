import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Users, Loader2, Edit2, Trash2, X, MessageCircle, Send, ArrowLeft, Download, Copy, Reply, ChevronRight, Camera, Paperclip } from 'lucide-react';
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
    comments: "Комментарии",
    noComments: "Пока нет комментариев",
    commentPlaceholder: "Комментарий...",
    replyAction: "Ответить",
    copy: "Копировать",
    editAction: "Изменить",
    deleteAction: "Удалить"
  },
  en: {
    wall: "Wall",
    chats: "Chats",
    refresh: "Refresh",
    emptyDesc: "New posts will appear here.",
    comments: "Comments",
    noComments: "No comments yet",
    commentPlaceholder: "Comment...",
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
  
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mesbook_user') || '{}'); } catch(e) { return {}; } })();

  const [lang] = useState<'ru' | 'en'>((localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru');
  const t = translations[lang] || translations.ru;

  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");

  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadComments, setThreadComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [isCommentUploading, setIsCommentUploading] = useState(false);
  const [commentReplyingTo, setCommentReplyingTo] = useState<any>(null);
  
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const photoOpenedRef = useRef(false);

  const [contextMenu, setContextMenu] = useState<{ id: number, x: number, y: number, type: 'post' | 'comment', item: any } | null>(null);

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
    if (activeThread) {
      loadComments(activeThread.chatId, activeThread.id);
    }
  }, [activeThread]);

  useEffect(() => {
    if (commentsScrollRef.current && threadComments.length > 0) {
      commentsScrollRef.current.scrollTop = commentsScrollRef.current.scrollHeight;
    }
  }, [threadComments]);

  // СВЕРХБЕЗОПАСНЫЙ ПАРСЕР КОНТЕНТА (ЗАЩИТА ОТ КРАША СТЕНЫ)
  const parseContent = (rawText: any) => {
    if (!rawText || typeof rawText !== 'string') {
      return { text: String(rawText || ''), quotedText: null, mediaUrls: [], hasMedia: false, hasText: !!rawText, isVideo: false };
    }
    
    const mediaUrls: string[] = [];
    const mediaRegex = /\[MEDIA\]\s*(https?:\/\/[^\s]+)/g;
    let match;
    let text = rawText;
    
    try {
      while ((match = mediaRegex.exec(text)) !== null) {
        if (match && match[1]) {
          mediaUrls.push(match[1]);
        }
      }
      text = text.replace(mediaRegex, '').trim();
    } catch (e) {}
    
    let quotedText = null;
    try {
      if (text.startsWith('> ')) {
        const parts = text.split('\n\n');
        if (parts.length > 0) {
          quotedText = parts[0].replace('> ', '');
          text = parts.slice(1).join('\n\n');
        }
      }
    } catch (e) {}

    const hasMedia = mediaUrls.length > 0;
    const hasText = !!text || !!quotedText;
    const isVideo = hasMedia && !!mediaUrls[0] && (mediaUrls[0].match(/\.(mp4|webm|mov|ogg)$/i) || mediaUrls[0].includes('/video/upload/'));
    
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

  const deleteItem = async (id: number, isComment = false) => {
    try {
      const targetChatId = isComment && activeThread ? activeThread.chatId : posts.find(p => p.id === id)?.chatId;
      if (!targetChatId) return;
      
      await fetch(`/api/chats/${targetChatId}/messages/${id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': 'Bearer ' + currentUserId } 
      });
      
      if (isComment) loadComments(activeThread.chatId, activeThread.id); 
      else loadFeed();
    } catch (e) {}
  };

  const toggleReaction = async (id: number, reaction: string, isComment = false) => {
    setContextMenu(null);
    
    const updateReactions = (item: any) => {
      const newR = { ...(item.reactions || {}) };
      if (item.myReaction === reaction) {
        if (newR[reaction]) newR[reaction].count = Math.max(0, newR[reaction].count - 1);
        if (newR[reaction]?.count === 0) delete newR[reaction];
        return { ...item, reactions: newR, myReaction: null };
      } else {
        if (item.myReaction && newR[item.myReaction]) {
          newR[item.myReaction].count = Math.max(0, newR[item.myReaction].count - 1);
          if (newR[item.myReaction].count === 0) delete newR[item.myReaction];
        }
        if (!newR[reaction]) newR[reaction] = { count: 0, users: [] };
        newR[reaction].count++;
        if (currentUser) {
          const userObj = { id: currentUserId, name: currentUser.displayName, avatar: currentUser.avatarUrl };
          newR[reaction].users = [userObj, ...newR[reaction].users.filter((u:any) => u.id !== currentUserId)];
        }
        return { ...item, reactions: newR, myReaction: reaction };
      }
    };

    if (isComment) {
      setThreadComments(prev => prev.map(c => c.id === id ? updateReactions(c) : c));
    } else {
      setPosts(prev => prev.map(p => p.id === id ? updateReactions(p) : p));
    }

    try {
      const targetChatId = isComment && activeThread ? activeThread.chatId : posts.find(p => p.id === id)?.chatId;
      if (!targetChatId) return;
      
      await fetch(`/api/chats/${targetChatId}/messages/${id}/reaction`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
        body: JSON.stringify({ reaction }) 
      });
    } catch (e) {}
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !activeThread) return;
    
    const tempContent = commentContent.trim();
    const finalContent = commentReplyingTo ? `> ${commentReplyingTo.content.replace(/^> .*\n\n/, '')}\n\n${tempContent}` : tempContent;
    
    setCommentContent('');
    setCommentReplyingTo(null);
    
    try {
      await fetch(`/api/chats/${activeThread.chatId}/messages`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
        body: JSON.stringify({ content: finalContent, parentId: activeThread.id }) 
      });
      loadComments(activeThread.chatId, activeThread.id);
    } catch (error) {}
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeThread) return;
    
    setIsCommentUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud'); 
    
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.secure_url) { 
        await fetch(`/api/chats/${activeThread.chatId}/messages`, { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId }, 
           body: JSON.stringify({ content: `[MEDIA] ${data.secure_url}`, parentId: activeThread.id }) 
        });
        loadComments(activeThread.chatId, activeThread.id);
      }
    } catch (err: any) {} 
    finally { 
      setIsCommentUploading(false); 
      if (commentFileInputRef.current) commentFileInputRef.current.value = ''; 
    }
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
    } catch (e) { 
      window.open(url, '_blank'); 
    }
  };

  const openGlobalMenu = (e: React.MouseEvent | React.TouchEvent, item: any, type: 'post' | 'comment') => {
    e.stopPropagation();
    e.preventDefault();
    if (photoOpenedRef.current) { photoOpenedRef.current = false; return; }
    
    let clientX, clientY;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    setContextMenu({ id: item.id, x: clientX, y: clientY, type, item });
  };

  const handleTouchStartPhoto = (e: React.TouchEvent | React.MouseEvent, url: string) => {
    e.stopPropagation();
    photoOpenedRef.current = false;
    
    pressTimer.current = setTimeout(() => {
      photoOpenedRef.current = true;
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
      setFullScreenImage(url); 
      setContextMenu(null);
    }, 400); 
  };

  const clearPhotoTimer = () => { 
    if (pressTimer.current) clearTimeout(pressTimer.current); 
  };

  const handlePhotoClick = (e: React.MouseEvent | React.TouchEvent, item: any, type: 'post' | 'comment') => {
    e.stopPropagation();
    e.preventDefault();
    clearPhotoTimer();
    if (photoOpenedRef.current) { photoOpenedRef.current = false; return; }
    openGlobalMenu(e, item, type);
  }

  const activeThreadContent = activeThread ? parseContent(activeThread.content) : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans relative overflow-hidden selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20 animate-in fade-in duration-300 ease-out" onClick={() => setContextMenu(null)}>
      
      {/* ЛАЙТБОКС */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-200 ease-out">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 w-full z-10">
            <button onClick={() => setFullScreenImage(null)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><X size={24} /></button>
            <button onClick={() => downloadImage(fullScreenImage)} className="p-2 text-white bg-black/30 rounded-full backdrop-blur-md active:scale-95 transition-transform"><Download size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden touch-pinch-zoom">
            <img src={fullScreenImage} alt="Fullscreen Media" className="max-w-full max-h-full object-contain select-none" />
          </div>
        </div>
      )}

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ */}
      {editingPost && (
        <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 ease-out">
          <div className="bg-white dark:bg-[#222224] w-full max-w-md rounded-[24px] overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.1)] dark:shadow-none border border-black/5 dark:border-white/5">
            <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-[18px] text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.editPost}</h3>
              <button onClick={() => setEditingPost(null)} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"><X size={22}/></button>
            </div>
            <div className="p-5">
              <textarea
                className="w-full bg-[#f5f5f7] dark:bg-[#161618] rounded-[16px] p-4 text-[16px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none border border-black/5 dark:border-white/5 transition-colors focus:border-black/20 dark:focus:border-white/20"
                rows={5}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
            </div>
            <div className="px-5 py-4 flex gap-3">
              <button onClick={() => setEditingPost(null)} className="flex-1 py-3.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#333336] rounded-[16px] active:scale-95 transition-transform">{t.cancel}</button>
              <button onClick={saveEditedPost} className="flex-1 py-3.5 font-semibold text-[#f5f5f7] dark:text-[#1d1d1f] bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-[16px] active:scale-95 transition-transform shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none">{t.save}</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center px-4 pt-12 pb-4 bg-white/80 dark:bg-[#222224]/80 sticky top-0 z-10 border-b border-black/5 dark:border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl">
        <button onClick={() => loadFeed(false)} className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] font-medium active:scale-95 transition-all ml-1">{t.refresh}</button>
        <h1 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[20px] font-bold absolute left-1/2 -translate-x-1/2 tracking-tight">{t.wall}</h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-1 overflow-y-auto pt-4 pb-4 px-4">
        <div className="flex flex-col w-full max-w-full">
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
            </div>
          ) : (
            posts.map((post) => {
              const { text, quotedText, mediaUrls, hasMedia, hasText, isVideo } = parseContent(post.content);
              const pReactionsKeys = post.reactions ? Object.keys(post.reactions) : [];
              const timeStr = post.createdAt ? new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div key={post.id} className="w-full relative mb-5 z-10 animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out">
                  <div 
                    className="w-full bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 flex flex-col cursor-pointer"
                    onClick={(e) => openGlobalMenu(e, post, 'post')}
                    onContextMenu={(e) => openGlobalMenu(e, post, 'post')}
                  >
                    <div className="px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#222224] flex justify-between items-center rounded-t-[24px]">
                       <Link href={`/chat/${post.chatId}`}>
                          <a className="font-semibold text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight hover:opacity-80 transition-opacity">
                            {post.channelName}
                          </a>
                       </Link>
                       <span className="text-[12px] font-medium text-[#86868b] dark:text-[#98989d]">{timeStr}</span>
                    </div>
                    
                    {hasMedia && (
                      <div className="relative w-full flex justify-center bg-[#f5f5f7] dark:bg-[#161618]">
                        {mediaUrls.map((url, idx) => (
                           isVideo 
                             ? <video key={idx} src={url} controls className="w-full h-auto max-h-[500px] object-cover" onClick={(e) => e.stopPropagation()} />
                             : <img 
                                  key={idx} 
                                  src={url} 
                                  loading="lazy" 
                                  decoding="async" 
                                  className="w-full h-auto max-h-[500px] object-cover pointer-events-none" 
                                  style={{ WebkitTouchCallout: 'none', userSelect: 'none' }} 
                                  onTouchStart={(e) => handleTouchStartPhoto(e, url)} 
                                  onMouseDown={(e) => handleTouchStartPhoto(e, url)} 
                                  onTouchEnd={clearPhotoTimer} 
                                  onMouseUp={clearPhotoTimer} 
                                  onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x400/1c1c1e/ffffff?text=Image+Not+Found'; }}
                               />
                        ))}
                      </div>
                    )}
                    
                    {hasText && (
                      <div className="px-4 pt-3 pb-2.5">
                         {quotedText && (
                           <div className="mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">{quotedText}</div>
                         )}
                         <div className="text-[16px] leading-[1.35] break-words whitespace-pre-wrap text-[#1d1d1f] dark:text-[#f5f5f7]">
                           {text}
                         </div>
                      </div>
                    )}

                    {pReactionsKeys.length > 0 && (
                      <div className="px-4 pb-3 flex flex-wrap gap-1.5 pt-1.5">
                         {pReactionsKeys.map(key => {
                           const rData = post.reactions[key];
                           const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                           
                           return (
                             <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(post.id, key); }} className={`flex items-center justify-center gap-1.5 h-[28px] px-3 rounded-full border transition-transform hover:scale-105 active:scale-95 ${post.myReaction === key ? 'bg-black/5 dark:bg-white/20 border-black/20 dark:border-white/30 z-10' : 'bg-[#f5f5f7] dark:bg-[#333336] border-black/5 dark:border-white/5 shadow-sm'}`}>
                               <span className="text-[14px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                               <span className={`text-[13px] font-bold leading-none flex items-center justify-center mt-[1px] ${post.myReaction === key ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{count}</span>
                             </button>
                           );
                         })}
                      </div>
                    )}

                    <button onClick={(e) => { e.stopPropagation(); setActiveThread(post); loadComments(post.chatId, post.id); }} className="w-full flex items-center justify-between px-3 py-2 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-b-[24px]">
                      <div className="flex gap-2 items-center">
                        <MessageCircle size={16} className="text-[#86868b] dark:text-[#98989d]" />
                        <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {post.commentsCount > 0 ? `${post.commentsCount} ${declOfNum(post.commentsCount, t.commentsCount, lang)}` : t.comments}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-[#86868b] dark:text-[#98989d]" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* МОДАЛКА КОММЕНТАРИЕВ */}
      {activeThread && (
        <div className="fixed inset-0 z-[80] bg-[#f5f5f7] dark:bg-[#161618] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out" onClick={() => setContextMenu(null)}>
          <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-black/5 dark:border-white/5 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveThread(null)} className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"><ArrowLeft size={26} strokeWidth={2} /></button>
              <h1 className="text-[18px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{t.comments}</h1>
            </div>
          </header>
          
          <div ref={commentsScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-10">
            <div className="bg-white dark:bg-[#222224] p-4 rounded-[20px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none mb-2 border border-black/5 dark:border-white/5 flex flex-col">
              <span className="font-semibold text-[14px] text-[#86868b] dark:text-[#98989d] mb-1 block">{activeThread.channelName}</span>
              {activeThreadContent?.hasMedia && (
                <div className="flex gap-2 overflow-x-auto my-2">
                  {activeThreadContent.mediaUrls.map((url: string) => (
                    <img key={url} src={url} className="h-[80px] w-auto rounded-[8px] object-cover border border-black/5 dark:border-white/5" />
                  ))}
                </div>
              )}
              {activeThreadContent?.hasText && (
                <p className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap">{activeThreadContent.text}</p>
              )}
            </div>
            
            {threadComments.length === 0 ? (
               <div className="text-center text-[#86868b] dark:text-[#98989d] mt-10 font-medium">{t.noComments}</div>
            ) : (
               threadComments.map((c) => {
                 const { text, quotedText, hasMedia, mediaUrls, hasText } = parseContent(c.content);
                 const cReactionsKeys = c.reactions ? Object.keys(c.reactions) : [];

                 return (
                   <div key={c.id} className="relative flex flex-col mb-2 z-10">
                     <div 
                        className="flex gap-3 items-start cursor-pointer" 
                        onClick={(e) => openGlobalMenu(e, c, 'comment')}
                        onContextMenu={(e) => openGlobalMenu(e, c, 'comment')}
                     >
                       <div className="w-9 h-9 rounded-full bg-[#e5e5ea] dark:bg-[#333336] flex items-center justify-center shrink-0 overflow-hidden text-[13px] font-medium border border-black/5 dark:border-white/5 text-[#1d1d1f] dark:text-[#f5f5f7]">
                         {c.senderAvatar ? <img src={c.senderAvatar} className="w-full h-full object-cover" /> : c.senderName?.charAt(0).toUpperCase() || 'U'}
                       </div>
                       <div className="flex flex-col flex-1 bg-white dark:bg-[#222224] p-3 rounded-[18px] rounded-tl-[4px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5">
                         <span className="text-[13px] font-semibold mb-1 text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">{c.senderName}</span>
                         
                         {quotedText && (
                           <div className={`mb-1.5 pl-2.5 border-l-[3px] text-[13px] font-medium opacity-80 truncate border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]`}>{quotedText}</div>
                         )}

                         {hasMedia && (
                             <img 
                               src={mediaUrls[0]} 
                               className={`max-h-[200px] w-auto object-cover pointer-events-none ${hasText ? 'rounded-t-[8px] mb-1' : 'rounded-[8px]'}`} 
                               style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                               onTouchStart={(e) => handleTouchStartPhoto(e, mediaUrls[0])} 
                               onMouseDown={(e) => handleTouchStartPhoto(e, mediaUrls[0])}
                               onTouchEnd={clearPhotoTimer} 
                               onMouseUp={clearPhotoTimer}
                               onClick={(e) => handlePhotoClick(e, c, 'comment')}
                               onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openGlobalMenu(e, c, 'comment'); }}
                             />
                         )}
                         {hasText && (
                             <span className="text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-pre-wrap leading-snug">{text}</span>
                         )}
                         <span className="text-[11px] text-[#86868b] dark:text-[#98989d] mt-1.5 text-right">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       </div>
                     </div>

                     {/* Реакции в комментариях */}
                     {cReactionsKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 justify-start pl-12">
                          {cReactionsKeys.map(key => {
                             const rData = c.reactions[key];
                             const count = typeof rData === 'number' ? rData : (rData?.count || 1);
                             const users = Array.isArray(rData) ? rData : (rData?.users || []);
                             const firstUser = users.length > 0 ? users[0] : null;

                             return (
                               <button key={key} onClick={(e) => { e.stopPropagation(); toggleReaction(c.id, key, true); }} className={`flex items-center justify-center gap-1 h-[24px] pl-0.5 pr-2 rounded-full border transition-transform active:scale-95 ${c.myReaction === key ? 'bg-black/5 dark:bg-white/10 border-black/20 dark:border-white/20 shadow-sm z-10' : 'bg-[#f5f5f7] dark:bg-[#333336] border-black/5 dark:border-white/5 shadow-sm'}`}>
                                 {firstUser ? (
                                   <div className="w-[18px] h-[18px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-[#222224] text-[9px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
                                     {firstUser.avatar ? <img src={firstUser.avatar} className="w-full h-full object-cover" /> : firstUser.name?.charAt(0).toUpperCase() || 'U'}
                                   </div>
                                 ) : (
                                   <span className="pl-1"></span>
                                 )}
                                 <span className="text-[13px] leading-none flex items-center justify-center mt-[1px]">{key}</span>
                                 {count > 1 && <span className={`text-[11px] font-bold leading-none flex items-center justify-center mt-[1px] pl-1 ${c.myReaction === key ? 'text-[#1d1d1f] dark:text-[#f5f5f7]' : 'text-[#86868b] dark:text-[#98989d]'}`}>{count}</span>}
                               </button>
                             );
                          })}
                        </div>
                     )}
                   </div>
                 );
               })
            )}
          </div>
          
          <div className="bg-white/80 dark:bg-[#222224]/80 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col backdrop-blur-xl">
             {commentReplyingTo && (
              <div className="flex items-center justify-between mb-1 mt-3 mx-4 px-4 py-2.5 bg-[#f5f5f7] dark:bg-[#161618] rounded-[14px] border-l-[3px] border-[#1d1d1f] dark:border-[#f5f5f7]">
                <div className="flex flex-col mr-4">
                  <span className="text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase">{t.replyAction}</span>
                  <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate">{parseContent(commentReplyingTo.content).text || t.photo}</span>
                </div>
                <button type="button" onClick={() => setCommentReplyingTo(null)} className="p-1.5 flex-shrink-0 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"><X size={16} /></button>
              </div>
             )}
            <form onSubmit={handleSendComment} className="p-3 flex items-center gap-2 pb-6">
              <input type="file" accept="image/*,video/*" className="hidden" ref={commentFileInputRef} onChange={handleCommentFileUpload} />
              <button type="button" onClick={() => commentFileInputRef.current?.click()} disabled={isCommentUploading} className="w-[38px] h-[38px] shrink-0 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors disabled:opacity-50">
                {isCommentUploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}
              </button>
              <input 
                className="flex-1 bg-[#f5f5f7] dark:bg-[#161618] border border-black/5 dark:border-white/5 rounded-full px-5 py-2.5 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-[15px] transition-colors focus:border-black/20 dark:focus:border-white/20" 
                value={commentContent} 
                onChange={e => setCommentContent(e.target.value)} 
                placeholder={t.commentPlaceholder} 
              />
              <button type="submit" disabled={!commentContent.trim()} className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-[#f5f5f7] dark:text-[#1d1d1f] flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none">
                <ChevronRight size={20} strokeWidth={2.5} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ГЛОБАЛЬНОЕ МЕНЮ ПО КООРДИНАТАМ */}
      {contextMenu && (() => {
         const menuWidth = 220; 
         const menuHeight = 250;
         let safeX = contextMenu.x; 
         let safeY = contextMenu.y;
         
         if (safeX + menuWidth > window.innerWidth) safeX = window.innerWidth - menuWidth - 10;
         if (safeY + menuHeight > window.innerHeight) safeY = safeY - menuHeight;
         if (safeY < 0) safeY = 20;
         
         const isMe = String(contextMenu.item.senderId) === String(currentUserId);
         const { hasText, hasMedia } = parseContent(contextMenu.item.content);
         
         const showReply = contextMenu.type === 'comment';
         const showCopy = hasText;
         const showEdit = isMe && !hasMedia && contextMenu.type === 'post';
         const showDelete = (isMe && !hasMedia && contextMenu.type === 'post') || (isMe && contextMenu.type === 'comment');

         if (!showReply && !showCopy && !showEdit && !showDelete) return null;

         return (
           <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
             <div className="absolute flex flex-col gap-2 animate-in zoom-in-[0.95] fade-in duration-200" style={{ top: safeY, left: safeX }} onClick={e => e.stopPropagation()}>
                <div className="flex gap-1.5 p-2 bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-full shadow-lg border border-black/5 dark:border-white/5">
                   {FAST_REACTIONS.map(emoji => (
                     <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(contextMenu.id, emoji, contextMenu.type === 'comment'); }} className="w-8 h-8 flex items-center justify-center text-[20px] rounded-full hover:scale-125 transition-transform active:scale-95">{emoji}</button>
                   ))}
                </div>
                <div className="flex flex-col bg-white/95 dark:bg-[#222224]/95 backdrop-blur-xl rounded-[20px] shadow-lg border border-black/5 dark:border-white/5 overflow-hidden w-full">
                   {showReply && (
                     <button onClick={(e) => { e.stopPropagation(); setCommentReplyingTo(contextMenu.item); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                       <Reply size={18} className="text-[#86868b]" /> {t.replyAction}
                     </button>
                   )}
                   {showCopy && (
                     <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(parseContent(contextMenu.item.content).text); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                       <Copy size={18} className="text-[#86868b]" /> {t.copy}
                     </button>
                   )}
                   {showEdit && (
                     <button onClick={(e) => { e.stopPropagation(); setContextMenu(null); startEditingPost(contextMenu.item); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5">
                       <Edit2 size={18} className="text-[#86868b]" /> {t.editAction}
                     </button>
                   )}
                   {showDelete && (
                     <button onClick={(e) => { e.stopPropagation(); deleteItem(contextMenu.id, contextMenu.type === 'comment'); setContextMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/5 dark:hover:bg-white/5">
                       <Trash2 size={18} className="text-[#86868b]" /> {t.deleteAction}
                     </button>
                   )}
                </div>
             </div>
           </div>
         );
      })()}

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
