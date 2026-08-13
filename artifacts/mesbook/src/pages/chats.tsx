import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpRight, MessageCircle } from 'lucide-react';
import { getListChatsQueryKey, useListChats } from '@workspace/api-client-react';
import { AppShell, Avatar, EmptyState, ErrorState, LoadingList, PageIntro, formatRelative } from '@/components/mesbook-shell';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const chatsQuery = useListChats({ query: { queryKey: getListChatsQueryKey() } });
  const chats = chatsQuery.data ?? [];
  const visibleChats = useMemo(() => chats.filter((chat) => `${chat.participant.displayName} ${chat.lastMessage}`.toLowerCase().includes(search.toLowerCase())), [chats, search]);
  return (
    <AppShell>
      <PageIntro eyebrow="A quieter inbox" title="Chats" subtitle="Private words, kept close." action={<button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] transition-transform hover:scale-105 active:scale-95" aria-label="Focus search" onClick={() => document.getElementById('input-search-chats')?.focus()} data-testid="button-focus-search"><Search size={18} /></button>} />
      <div className="px-5 pb-5">
        <label className="flex h-12 items-center gap-3 rounded-2xl bg-[hsl(var(--background))] px-4 text-[hsl(var(--muted-foreground))]">
          <Search size={17} />
          <input id="input-search-chats" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]" data-testid="input-search-chats" />
          {search && <button type="button" onClick={() => setSearch('')} className="text-xs font-bold" data-testid="button-clear-search">Clear</button>}
        </label>
      </div>
      {chatsQuery.isLoading ? <LoadingList /> : chatsQuery.isError ? <ErrorState onRetry={() => chatsQuery.refetch()} /> : visibleChats.length === 0 ? (
        <EmptyState icon={MessageCircle} title={search ? 'No matches here' : 'Your quiet corner is ready'} body={search ? 'Try a different name or phrase.' : 'When a private conversation starts, it will settle here.'} />
      ) : (
        <div className="px-4" data-testid="list-chats">
          {visibleChats.map((chat, index) => (
            <Link href={`/chat/${chat.id}`} className="group flex items-center gap-3 rounded-2xl px-2 py-3.5 transition-colors hover:bg-[hsl(var(--background))] animate-rise-in" style={{ animationDelay: `${index * 55}ms` }} data-testid={`link-chat-${chat.id}`} key={chat.id}>
              <Avatar name={chat.participant.displayName} url={chat.participant.avatarUrl} testId={`img-chat-avatar-${chat.id}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="truncate font-display text-[15px] font-bold text-[hsl(var(--foreground))]" data-testid={`text-chat-name-${chat.id}`}>{chat.participant.displayName}</h2>
                  <span className="shrink-0 text-[11px] font-medium text-[hsl(var(--muted-foreground))]" data-testid={`text-chat-time-${chat.id}`}>{formatRelative(chat.lastMessageAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm text-[hsl(var(--muted-foreground))]" data-testid={`text-chat-preview-${chat.id}`}>{chat.lastMessage || 'Start a conversation'}</p>
                  {chat.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-[10px] font-bold text-white" data-testid={`badge-unread-${chat.id}`}>{chat.unreadCount}</span>}
                </div>
              </div>
              <ArrowUpRight size={16} className="text-[hsl(var(--border))] transition-colors group-hover:text-[hsl(var(--primary))]" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}