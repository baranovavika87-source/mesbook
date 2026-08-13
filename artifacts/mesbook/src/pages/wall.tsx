import { FormEvent, useState } from 'react';
import { Globe2, Send, Sparkles } from 'lucide-react';
import { getGetMeQueryKey, getListWallPostsQueryKey, useCreateWallPost, useGetMe, useListWallPosts } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, Avatar, EmptyState, ErrorState, LoadingList, PageIntro, formatTime } from '@/components/mesbook-shell';

export default function WallPage() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const postsQuery = useListWallPosts({ query: { queryKey: getListWallPostsQueryKey() } });
  const createPost = useCreateWallPost();
  const [content, setContent] = useState('');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || createPost.isPending) return;
    createPost.mutate({ data: { content: trimmed } }, {
      onSuccess: () => {
        setContent('');
        queryClient.invalidateQueries({ queryKey: getListWallPostsQueryKey() });
      },
    });
  };
  const posts = postsQuery.data ?? [];
  return (
    <AppShell>
      <PageIntro eyebrow="Out in the open" title="Wall" subtitle="Small thoughts, shared softly." action={<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--accent))]"><Globe2 size={18} /></div>} />
      <section className="mx-5 mb-7 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 animate-pop-in" aria-label="Publish a Wall post">
        <div className="mb-3 flex items-center gap-3"><Avatar name={me?.displayName ?? 'You'} url={me?.avatarUrl} size="sm" testId="img-wall-composer-avatar" /><div><p className="text-sm font-bold" data-testid="text-wall-composer-name">{me?.displayName ?? 'Your voice'}</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Visible to everyone on the Wall</p></div></div>
        <form onSubmit={handleSubmit}>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} rows={3} placeholder="Leave a little light here…" className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted-foreground))]" data-testid="input-wall-post" />
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-3"><span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]" data-testid="text-wall-character-count">{content.length}/500</span><button type="submit" disabled={!content.trim() || createPost.isPending} className="flex items-center gap-2 rounded-full bg-[hsl(var(--foreground))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--card))] transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-publish-wall"><Send size={14} /> {createPost.isPending ? 'Publishing' : 'Publish'}</button></div>
        </form>
        {createPost.isError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-wall-error">That thought did not publish. Please try again.</p>}
      </section>
      <div className="flex items-center gap-2 px-6 pb-3 text-[11px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]"><Sparkles size={13} className="text-[hsl(var(--primary))]" /> Recent notes</div>
      {postsQuery.isLoading ? <LoadingList count={3} /> : postsQuery.isError ? <ErrorState onRetry={() => postsQuery.refetch()} message="The Wall is taking a breather." /> : posts.length === 0 ? <EmptyState icon={Sparkles} title="It is quiet here" body="Be the first person to leave a short thought on the Wall." /> : (
        <div className="divide-y divide-[hsl(var(--border))] px-5" data-testid="list-wall-posts">
          {posts.map((post, index) => <article className="flex gap-3 py-5 animate-rise-in" style={{ animationDelay: `${index * 60}ms` }} data-testid={`card-wall-post-${post.id}`} key={post.id}><Avatar name={post.author.displayName} url={post.author.avatarUrl} size="sm" testId={`img-wall-avatar-${post.id}`} /><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-3"><h2 className="truncate text-sm font-bold" data-testid={`text-wall-author-${post.id}`}>{post.author.displayName}</h2><time className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]" dateTime={post.createdAt}>{formatTime(post.createdAt, true)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--foreground))]" data-testid={`text-wall-content-${post.id}`}>{post.content}</p></div></article>)}
        </div>
      )}
    </AppShell>
  );
}