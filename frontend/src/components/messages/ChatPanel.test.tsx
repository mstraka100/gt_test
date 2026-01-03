import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';
import { ChatPanel } from './ChatPanel';
import { mockUser, mockUsers } from '../../test/mocks';

const mockChannel = {
  id: 'channel-1',
  name: 'general',
  type: 'public' as const,
  creatorId: 'user-1',
  memberIds: ['user-1'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockDM = {
  id: 'dm-1',
  type: 'dm' as const,
  participantIds: ['user-1', 'user-2'],
  participants: mockUsers,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockSendMessage = vi.fn();
const mockSendTyping = vi.fn();

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    currentView: 'none',
    currentChannelId: null,
    currentDMId: null,
  })),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: mockUser,
  })),
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocket: vi.fn(() => ({
    newMessages: [],
    typingUsers: [],
    sendMessage: mockSendMessage,
    sendTyping: mockSendTyping,
  })),
}));

vi.mock('../../api/channels', () => ({
  getChannel: vi.fn(() => Promise.resolve(mockChannel)),
  getChannelMessages: vi.fn(() => Promise.resolve({ messages: [], hasMore: false })),
}));

vi.mock('../../api/dms', () => ({
  getDM: vi.fn(() => Promise.resolve(mockDM)),
  getDMMessages: vi.fn(() => Promise.resolve({ messages: [], hasMore: false })),
}));

import { useUIStore } from '../../stores/uiStore';

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows welcome message when no channel or DM is selected', () => {
    vi.mocked(useUIStore).mockReturnValue({
      currentView: 'none',
      currentChannelId: null,
      currentDMId: null,
    } as ReturnType<typeof useUIStore>);

    render(<ChatPanel />);

    expect(screen.getByText('Welcome to Slit')).toBeInTheDocument();
    expect(screen.getByText('Select a channel or DM to start chatting')).toBeInTheDocument();
  });

  it('shows wave emoji in welcome message', () => {
    vi.mocked(useUIStore).mockReturnValue({
      currentView: 'none',
      currentChannelId: null,
      currentDMId: null,
    } as ReturnType<typeof useUIStore>);

    render(<ChatPanel />);

    expect(screen.getByText('👋')).toBeInTheDocument();
  });

  it('shows loading or channel title when channel is selected', async () => {
    vi.mocked(useUIStore).mockReturnValue({
      currentView: 'channel',
      currentChannelId: 'channel-1',
      currentDMId: null,
    } as ReturnType<typeof useUIStore>);

    render(<ChatPanel />);

    // The header shows Loading... initially, or the channel title after query resolves
    const header = document.querySelector('.font-bold');
    expect(header).toBeInTheDocument();
  });

  it('renders message input', () => {
    vi.mocked(useUIStore).mockReturnValue({
      currentView: 'channel',
      currentChannelId: 'channel-1',
      currentDMId: null,
    } as ReturnType<typeof useUIStore>);

    render(<ChatPanel />);

    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('has proper flex layout structure', () => {
    vi.mocked(useUIStore).mockReturnValue({
      currentView: 'channel',
      currentChannelId: 'channel-1',
      currentDMId: null,
    } as ReturnType<typeof useUIStore>);

    const { container } = render(<ChatPanel />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('flex-1');
    expect(mainContainer).toHaveClass('flex');
    expect(mainContainer).toHaveClass('flex-col');
  });
});
