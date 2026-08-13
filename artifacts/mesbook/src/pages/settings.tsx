import { FormEvent, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Save, UserRound } from 'lucide-react';
import { getGetMeQueryKey, useGetMe, useUpdateMe } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, Avatar, ErrorState, PageIntro } from '@/components/mesbook-shell';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const meQuery = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateMe = useUpdateMe();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (meQuery.data) {
      setDisplayName(meQuery.data.displayName);
      setAvatarUrl(meQuery.data.avatarUrl);
    }
  }, [meQuery.data]);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim() || updateMe.isPending) return;
    setSaved(false);
    updateMe.mutate({ data: { displayName: displayName.trim(), avatarUrl: avatarUrl.trim() } }, {
      onSuccess: (user) => {
        queryClient.setQueryData(getGetMeQueryKey(), user);
        setSaved(true);
      },
    });
  };
  if (meQuery.isError) return <AppShell><PageIntro eyebrow="Your corner" title="Settings" /><ErrorState onRetry={() => meQuery.refetch()} message="Profile could not be loaded." /></AppShell>;
  return (
    <AppShell>
      <PageIntro eyebrow="Your corner" title="Settings" subtitle="Keep your presence feeling like you." />
      <form onSubmit={handleSubmit} className="px-6 pb-10">
        <div className="mb-9 flex flex-col items-center rounded-3xl bg-[hsl(var(--background))] px-6 py-8 animate-pop-in"><Avatar name={displayName || 'You'} url={avatarUrl} size="lg" testId="img-profile-preview" /><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">This is how you appear on Mesbook.</p></div>
        <div className="space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Display name</span><div className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-2"><UserRound size={17} className="text-[hsl(var(--muted-foreground))]" /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={1} maxLength={60} placeholder="Your name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-testid="input-display-name" /></div></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Avatar URL</span><div className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-2"><ImageIcon size={17} className="text-[hsl(var(--muted-foreground))]" /><input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={500} type="url" placeholder="https://…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-testid="input-avatar-url" /></div><span className="mt-2 block text-xs text-[hsl(var(--muted-foreground))]">Optional. A square image works best.</span></label>
        </div>
        <button type="submit" disabled={!displayName.trim() || updateMe.isPending} className="mt-9 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--foreground))] text-sm font-bold text-[hsl(var(--card))] transition-all hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-save-profile">{saved ? <><Check size={17} /> Saved</> : <><Save size={16} /> {updateMe.isPending ? 'Saving' : 'Save changes'}</>}</button>
        {updateMe.isError && <p className="mt-3 text-center text-xs text-[hsl(var(--destructive))]" data-testid="status-profile-error">Could not save your profile. Try again.</p>}
      </form>
    </AppShell>
  );
}