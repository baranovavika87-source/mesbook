import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Send, Trash2, Loader2, Check } from 'lucide-react';

export default function ChatPage() {
  const [match, params] = useRoute("/chat/:chatId");
  const chatId = params?.chatId;
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [content, setContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const storedUser = localStorage.getItem("mesbook_user");
  const currentUserId = storedUser ? JSON.parse(storedUser).id : 1;

  const loadData = async () => {
    try {
      await fetch('/api/chats/' + chatId + '/read', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
    } catch (e) {}

    try {
      const infoRes = await fetch('/api/chats', {
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (infoRes.ok) {
        const allChats = await infoRes.json();
        let currentChat = allChats.find((c: any) => String(c.id) === String(chatId) || String(c.participant?.id) === String(chatId));

        if (!currentChat) {
          const userRes = await fetch('/api/users/' + chatId, {
            headers: { 'Authorization': 'Bearer ' + currentUserId }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            currentChat = { participant: userData };
          }
        }
        if (currentChat) setChatInfo(currentChat);
      }
    } catch (e) {}

    try {
      const msgRes = await fetch('/api/chats/' + chatId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(prev => {
          const sendingMsgs = prev.filter(m => m.isSending);
          const serverMsgs = data.filter((dm: any) => !sendingMsgs.find(sm => sm.content === dm.content));
          return [...serverMsgs, ...sendingMsgs].sort((a, b) => a.id - b.id);
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    const sendPing = async () => {
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + currentUserId }
        });
      } catch (e) {}
    };
    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const tempContent = content;
    const tempMsg = { 
      id: Date.now(), 
      content: tempContent, 
      isSending: true, 
      senderId: currentUserId, 
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setContent('');

    try {
      const res = await fetch('/api/chats/' + chatId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUserId },
        body: JSON.stringify({ content: tempContent })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, isSending: false } : m));
        loadData(); 
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    }
  };

  const handleDelete = async (msgId: number) => {
    if (!window.confirm("Точно удалить сообщение?")) return;
    try {
      const res = await fetch('/api/chats/' + chatId + '/messages/' + msgId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + currentUserId }
      });
      if (res.ok) loadData();
    } catch (error) {}
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <header className="px-4 pt-10 pb-4 border-b border-gray-200 dark:border-gray-800/50 flex items-center gap-3 bg-white dark:bg-gray-950 z-10 shadow-sm">
        <Link href="/">
          <a className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-full">
            <ArrowLeft size={24} />
          </a>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold uppercase">
            {chatInfo?.participant?.displayName?.charAt(0) || chatInfo?.participant?.name?.charAt(0) || "U"}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
              {chatInfo?.participant?.displayName || chatInfo?.participant?.name || "Собеседник"}
            </h2>
            <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-0.5">в сети</p>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const msgAuthorId = msg.senderId || msg.authorId || msg.userId || msg.author?.id;
          const isMe = String(msgAuthorId) === String(currentUserId);
          return (
            <div key={msg.id} className={'flex flex-col max-w-[80%] ' + (isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
              <div className={'px-4 py-2.5 rounded-2xl shadow-sm ' + (isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm')}>
                <p className="text-[15px] leading-relaxed">{msg.content}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                
                {isMe && (
                  <div className="flex items-center gap-2 ml-1">
                    {msg.isSending ? (
                      <Loader2 size={12} className="animate-spin text-blue-400" />
                    ) : (
                      <div className="flex -space-x-1.5">
                        <Check size={14} className="text-blue-500 dark:text-blue-400" />
                        {(msg.readAt || msg.isRead || msg.read || msg.status === 'read') && (
                          <Check size={14} className="text-blue-500 dark:text-blue-400" />
                        )}
                      </div>
                    )}
                    {!msg.isSending && (
                      <button onClick={() => handleDelete(msg.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800/50 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input type="text" placeholder="Сообщение..." value={content} onChange={e => setContent(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-full px-5 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition outline-none text-gray-900 dark:text-white placeholder:text-gray-600" />
          <button type="submit" disabled={!content.trim()} className="w-12 h-12 flex-shrink-0 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white transition active:scale-90 shadow-sm"><Send size={18} className="ml-1" /></button>
        </form>
      </div>
    </div>
  );
}
