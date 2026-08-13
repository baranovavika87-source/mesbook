import { useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageCircle, Settings2, Sparkles, UserRound } from 'lucide-react';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';

export function Avatar({ name, url, size = 'md', testId }: { name: string; url?: string; size?: 'sm' | 'md' | 'lg'; testId?: string }) {
  const initials = useMemo(() => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?', [name]);
  const sizes = { sm: 'h-9 w-9 text-[11px]', md: 'h-12 w-12 text-sm', lg: 'h-20 w-20 text-xl' };
  return url ? (
    <img src={url} alt={`${name} avatar`} className={`${sizes[size]} shrink-0 rounded-full object-cover ring-1 ring-black/5`} data-testid={testId ?? 'img-avatar'} />
  ) : (
    <div className={`${sizes[size]} shrink-0 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] flex items-center justify-center font-display font-bold ring-1 ring-black/5`} data-testid={testId ?? 'img-avatar'}>
      {initials}
    </div>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const items = [
    { href: '/', label: 'Chats', icon: MessageCircle, id: 'chats' },
    { href: '/wall', label: 'Wall', icon: Sparkles, id: 'wall' },
    { href: '/settings', label: 'Settings', icon: Settings2, id: 'settings' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[76px] max-w-[480px] items-center justify-around border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.94)] px-6 pb-2 backdrop-blur-xl safe-bottom" data-testid="nav-bottom">
      {items.map(({ href, label, icon: Icon, id }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return (
          <Link href={href} className={`group flex min-w-[66px] flex-col items-center gap-1.5 text-[11px] font-semibold transition-colors ${active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} data-testid={`link-nav-${id}`} key={href}>
            <span className={`flex h-8 w-12 items-center justify-center rounded-2xl transition-colors ${active ? 'bg-[hsl(var(--secondary))]' : 'group-hover:bg-[hsl(var(--muted))]'}`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, fullScreen = false }: { children: ReactNode; fullScreen?: boolean }) {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <main className={`mx-auto min-h-[100dvh] w-full max-w-[480px] bg-[hsl(var(--card))] shadow-[0_0_80px_rgba(57,47,51,.05)] ${fullScreen ? 'pb-0' : 'pb-[76px]'}`}>
        {children}
      </main>
      {!fullScreen && <BottomNav />}
      <span className="sr-only" data-testid="text-current-user">{me?.displayName ?? 'Mesbook member'}</span>
    </div>
  );
}

export function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-6 pb-6 pt-10">
      <div>
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--primary))]" data-testid="text-page-eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-[30px] font-extrabold leading-none tracking-[-.04em] text-[hsl(var(--foreground))]" data-testid="text-page-title">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 px-4" aria-label="Loading" data-testid="state-loading">
      {Array.from({ length: count }).map((_, index) => <div className="flex animate-pulse items-center gap-3 rounded-2xl px-2 py-3" key={index}><div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))]" /><div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded-full bg-[hsl(var(--muted))]" /><div className="h-3 w-3/4 rounded-full bg-[hsl(var(--muted))]" /></div></div>)}
    </div>
  );
}

export function ErrorState({ onRetry, message = 'Something went quiet.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="mx-6 my-10 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6 py-8 text-center" data-testid="state-error">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--accent))]"><MessageCircle size={18} /></div>
      <p className="font-display font-bold text-[hsl(var(--foreground))]">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-full bg-[hsl(var(--foreground))] px-4 py-2 text-xs font-bold text-[hsl(var(--card))] transition-transform active:scale-95" data-testid="button-retry">Try again</button>
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon = UserRound }: { title: string; body: string; icon?: typeof UserRound }) {
  return (
    <div className="mx-6 my-12 flex flex-col items-center text-center" data-testid="state-empty">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] bg-[hsl(var(--secondary))] text-[hsl(var(--accent))]"><Icon size={23} /></div>
      <h2 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">{title}</h2>
      <p className="mt-2 max-w-[260px] text-sm leading-5 text-[hsl(var(--muted-foreground))]">{body}</p>
    </div>
  );
}

export function formatTime(value: string, includeDay = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, includeDay ? { month: 'short', day: 'numeric' } : { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatRelative(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return formatTime(value, true);
}