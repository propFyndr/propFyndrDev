import { ChatSidebarGroupedSkeleton, DiscoveryHomeSkeleton } from '@/components/skeletons'

// Same geometry as the real page (260px sidebar, empty-state hero + composer),
// so the swap to content doesn't jump.
export default function DiscoverLoading() {
  return (
    <div className="flex h-[100dvh] bg-surface overflow-hidden">
      <div className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-border bg-surface-2 p-2 pt-16">
        <ChatSidebarGroupedSkeleton />
      </div>
      <main className="flex-1 flex">
        <DiscoveryHomeSkeleton />
      </main>
    </div>
  );
}
