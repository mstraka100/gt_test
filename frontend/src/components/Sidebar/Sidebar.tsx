import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Channel, DirectMessage, User } from '../../types';
import { api } from '../../api/client';

interface Props {
  selectedChannel: Channel | null;
  selectedDM: DirectMessage | null;
  onSelectChannel: (channel: Channel) => void;
  onSelectDM: (dm: DirectMessage) => void;
}

export function Sidebar({ selectedChannel, selectedDM, onSelectChannel, onSelectDM }: Props) {
  const { user, logout } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DirectMessage[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [channelsRes, dmsRes] = await Promise.all([
        api.get<{ channels: Channel[] }>('/channels'),
        api.get<{ dms: DirectMessage[] }>('/dms'),
      ]);
      setChannels(channelsRes.channels);
      setDMs(dmsRes.dms);
    } catch (error) {
      console.error('Failed to load sidebar data:', error);
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const { channel } = await api.post<{ channel: Channel }>('/channels', {
        name: newChannelName,
        type: 'public',
      });
      setChannels([...channels, channel]);
      setNewChannelName('');
      setShowNewChannel(false);
      onSelectChannel(channel);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const getOtherParticipants = (dm: DirectMessage): User[] => {
    return (dm.participants || []).filter((p) => p.id !== user?.id);
  };

  const getDMName = (dm: DirectMessage): string => {
    const others = getOtherParticipants(dm);
    if (others.length === 0) return 'Unknown';
    if (others.length === 1) return others[0].displayName;
    return others.map((u) => u.displayName).join(', ');
  };

  return (
    <div className="w-64 bg-[#3F0E40] text-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#522653]">
        <h1 className="font-bold text-lg">Slack Clone</h1>
        <div className="flex items-center mt-2 text-sm text-gray-300">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          {user?.displayName}
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between text-gray-400 text-sm mb-2">
            <span>Channels</span>
            <button
              onClick={() => setShowNewChannel(true)}
              className="hover:text-white"
            >
              +
            </button>
          </div>

          {showNewChannel && (
            <div className="mb-2 flex gap-1">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createChannel()}
                placeholder="channel-name"
                className="flex-1 bg-[#522653] px-2 py-1 rounded text-sm"
                autoFocus
              />
              <button
                onClick={createChannel}
                className="px-2 py-1 bg-green-600 rounded text-sm"
              >
                Add
              </button>
            </div>
          )}

          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full text-left px-2 py-1 rounded text-sm ${
                selectedChannel?.id === channel.id
                  ? 'bg-[#1164A3] text-white'
                  : 'text-gray-300 hover:bg-[#350d36]'
              }`}
            >
              # {channel.name}
            </button>
          ))}
        </div>

        {/* Direct Messages */}
        <div className="px-4 py-2">
          <div className="text-gray-400 text-sm mb-2">Direct Messages</div>
          {dms.map((dm) => (
            <button
              key={dm.id}
              onClick={() => onSelectDM(dm)}
              className={`w-full text-left px-2 py-1 rounded text-sm flex items-center ${
                selectedDM?.id === dm.id
                  ? 'bg-[#1164A3] text-white'
                  : 'text-gray-300 hover:bg-[#350d36]'
              }`}
            >
              <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
              {getDMName(dm)}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#522653]">
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
