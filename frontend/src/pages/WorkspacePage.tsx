import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { getChannels } from '../api/channels';
import { getDMs } from '../api/dms';
import Sidebar from '../components/layout/Sidebar';
import ChannelView from '../components/channel/ChannelView';
import DMView from '../components/dm/DMView';

export default function WorkspacePage() {
  const { currentView, currentChannelId, currentDMId } = useUIStore();
  const user = useAuthStore((s) => s.user);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: getChannels,
  });

  const { data: dms = [] } = useQuery({
    queryKey: ['dms'],
    queryFn: getDMs,
  });

  return (
    <div className="h-screen flex bg-[var(--slack-bg)]">
      {/* Workspace rail */}
      <div className="w-[70px] bg-[var(--slack-purple)] flex flex-col items-center py-3">
        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar channels={channels} dms={dms} currentUser={user} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {currentView === 'channel' && currentChannelId && (
          <ChannelView channelId={currentChannelId} />
        )}
        {currentView === 'dm' && currentDMId && (
          <DMView dmId={currentDMId} />
        )}
        {currentView === 'none' && (
          <div className="flex-1 flex items-center justify-center text-[var(--slack-text-muted)]">
            Select a channel or conversation to get started
          </div>
        )}
      </div>
    </div>
  );
}
