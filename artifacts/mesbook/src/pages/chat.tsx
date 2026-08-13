import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, Send, Wifi, WifiOff } from 'lucide-react';
import { getListChatsQueryKey, getListMessagesQueryKey, useCreateMessage, useListChats, useListMessages } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';
import { AppShell, Avatar, ErrorState, LoadingList, formatTime } from '@/components/mesbook-shell';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = Number(params.chatId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: chats } = useListChats({ query: { queryKey: getListChatsQueryKey() } });
  const messagesQuery = useListMessages(chatId, { query: { queryKey: getListMessagesQueryKey(chatId), enabled: Number.isFinite(chatId) && chatId > 0 } });
  const sendMessage = useCreateMessage();
  const [content, setContent] = useState('');
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [socketReady, setSocketReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<any>(null);
  const typingTimeout = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chat = useMemo(() => chats?.find((item) => item.id === chatId), [chats, chatId]);
  const messages = useMemo(() => {
    const ids = new Set((messagesQuery.data ?? []).map((message) => message.id));
    return [...(messagesQuery.data ?? []), ...liveMessages.filter((message) => !ids.has(message.id))].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messagesQuery.data, liveMessages]);

  const addLiveMessage = (message: Message) => {
    setLiveMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

     useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket; 

    const handler = (message: Message) => {
      if (message.chatId === chatId) {
        addLiveMessage(message);
      }
    };

    const handleConnect = () => {
      setSocketReady(true);
      socket.emit('join-chat', chatId);
    };

    const handleDisconnect = () => setSocketReady(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat:message', handler);
    
    // Новые слушатели для индикатора печати
    socket.on('user:typing', () => setIsTyping(true));
    socket.on('user:stopTyping', () => setIsTyping(false));

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat:message', handler);
      socket.off('user:typing');
      socket.off('user:stopTyping');
      socket.disconnect();
    };
  }, [chatId]);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sendMessage.isPending || !Number.isFinite(chatId)) return;
    sendMessage.mutate({ chatId, data: { content: trimmed } }, {
      onSuccess: (message) => {
        setContent('');
         addLiveMessage(message);
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      },
    });
  };

  return (
    <AppShell fullScreen>
      <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--card))]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.94)] px-5 backdrop-blur-xl">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--background))]" aria-label="Back to chats" data-testid="link-back-chats"><ArrowLeft size={20} /></Link>
          {chat ? <><Avatar name={chat.participant.displayName} url={chat.participant.avatarUrl} size="sm" testId="img-chat-header-avatar" /><div className="min-w-0 flex-1"><h1 className="truncate font-display text-[15px] font-bold" data-testid="text-chat-header-name">{chat.participant.displayName}</h1><p className="text-[11px] text-[hsl(var(--muted-foreground))]">{socketReady ? 'Live conversation' : 'Private conversation'}</p></div></> : <div className="flex-1"><h1 className="font-display font-bold">Conversation</h1></div>}
          {socketReady ? <Wifi size={15} className="text-[hsl(var(--accent))]" aria-label="Live connection" data-testid="status-socket-live" /> : <WifiOff size={15} className="text-[hsl(var(--muted-foreground))]" aria-label="API connection" data-testid="status-socket-api" />}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {!messagesQuery.isLoading && messages.length > 0 && <p className="mb-7 text-center text-[11px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Today</p>}
          {messagesQuery.isLoading ? <LoadingList count={5} /> : messagesQuery.isError ? <ErrorState onRetry={() => messagesQuery.refetch()} /> : messages.length === 0 ? <div className="flex min-h-[50vh] flex-col items-center justify-center text-center"><div className="mb-4 h-px w-10 bg-[hsl(var(--primary))]" /><h2 className="font-display text-lg font-bold">A blank page, for now.</h2><p className="mt-2 max-w-[230px] text-sm leading-5 text-[hsl(var(--muted-foreground))]">Send the first note and make this space yours.</p></div> : (
            <div className="space-y-3" data-testid="list-messages">
              {messages.map((message, index) => <div className={`flex animate-rise-in ${message.isMine ? 'justify-end' : 'justify-start'}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }} data-testid={`message-${message.id}`} key={`${message.id}-${message.createdAt}`}><div className={`max-w-[78%] ${message.isMine ? 'items-end' : 'items-start'} flex flex-col`}><div className={`rounded-[20px] px-4 py-3 text-[14px] leading-5 ${message.isMine ? 'rounded-br-md bg-[hsl(var(--primary))] text-white' : 'rounded-bl-md bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'}`} data-testid={`text-message-content-${message.id}`}>{message.content}</div><time className="mt-1 px-1 text-[10px] text-[hsl(var(--muted-foreground))]" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div></div>)}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="sticky bottom-0 flex gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={1} maxLength={2000} placeholder="Write something private…" className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-[hsl(var(--background))] px-4 py-3 text-sm leading-5 outline-none placeholder:text-[hsl(var(--muted-foreground))]" aria-label="Message" data-testid="input-message" />
          <button type="submit" disabled={!content.trim() || sendMessage.isPending} className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full bg-[hsl(var(--primary))] text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message" data-testid="button-send-message"><Send size={17} className={sendMessage.isPending ? 'animate-pulse' : ''} /></button>
          {sendMessage.isError && <span className="absolute bottom-1 left-5 text-[10px] text-[hsl(var(--destructive))]" data-testid="status-send-error">Could not send. Try again.</span>}
        </form>
      </div>
    </AppShell>
  );
}
