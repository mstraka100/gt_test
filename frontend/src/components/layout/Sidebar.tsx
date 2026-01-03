import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import type { Channel, DirectMessage, User } from '../../types';

interface SidebarProps {
  channels: Channel[];
  dms: DirectMessage[];
  currentUser: User | null;
}

export default function Sidebar({ channels, dms, currentUser }: SidebarProps) {
  const { currentChannelId, currentDMId, setCurrentChannel, setCurrentDM } = useUIStore();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="w-[260px] bg-[var(--slack-sidebar)] flex flex-col border-r border-[var(--slack-border)]">
      {/* Workspace header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--slack-border)]">
        <span className="font-bold text-white">Slack Clone</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-3">
        {/* Channels section */}
        <div className="mb-4">
          <div className="px-4 mb-1 flex items-center justify-between">
            <span className="text-[var(--slack-text-muted)] text-sm font-medium">Channels</span>
          </div>
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setCurrentChannel(channel.id)}
              className={`w-full px-4 py-1 text-left flex items-center gap-2 hover:bg-[var(--slack-hover)] ${
                currentChannelId === channel.id ? 'bg-[var(--slack-active)] text-white' : 'text-[var(--slack-text-muted)]'
              }`}
            >
              <span className="text-lg">#</span>
              <span className="truncate">{channel.name}</span>
            </button>
          ))}
        </div>

        {/* Direct Messages section */}
        <div>
          <div className="px-4 mb-1 flex items-center justify-between">
            <span className="text-[var(--slack-text-muted)] text-sm font-medium">Direct Messages</span>
          </div>
          {dms.map((dm) => {
            const otherParticipants = dm.participants?.filter(
              (p) => p.id !== currentUser?.id
            );
            const displayName = otherParticipants?.map((p) => p.displayName).join(', ') || 'Unknown';

            return (
              <button
                key={dm.id}
                onClick={() => setCurrentDM(dm.id)}
                className={`w-full px-4 py-1 text-left flex items-center gap-2 hover:bg-[var(--slack-hover)] ${
                  currentDMId === dm.id ? 'bg-[var(--slack-active)] text-white' : 'text-[var(--slack-text-muted)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                <span className="truncate">{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User footer */}
      <div className="h-12 px-4 flex items-center justify-between border-t border-[var(--slack-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[var(--slack-hover)] flex items-center justify-center text-white text-sm">
            {currentUser?.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-white text-sm truncate">{currentUser?.displayName}</span>
        </div>
        <button
          onClick={logout}
          className="text-[var(--slack-text-muted)] hover:text-white text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
