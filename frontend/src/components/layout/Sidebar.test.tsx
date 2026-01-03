import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { mockUser, mockUsers } from '../../test/mocks';
import type { Channel, DirectMessage } from '../../types';

const mockSetCurrentChannel = vi.fn();
const mockSetCurrentDM = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    currentChannelId: null,
    currentDMId: null,
    setCurrentChannel: mockSetCurrentChannel,
    setCurrentDM: mockSetCurrentDM,
  })),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      logout: mockLogout,
    })
  ),
}));

describe('Sidebar', () => {
  const mockChannels: Channel[] = [
    {
      id: 'channel-1',
      name: 'general',
      type: 'public',
      creatorId: 'user-1',
      memberIds: ['user-1'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'channel-2',
      name: 'random',
      type: 'public',
      creatorId: 'user-1',
      memberIds: ['user-1'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  const mockDMs: DirectMessage[] = [
    {
      id: 'dm-1',
      type: 'dm',
      participantIds: ['user-1', 'user-2'],
      participants: mockUsers,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workspace name', () => {
    render(<Sidebar channels={[]} dms={[]} currentUser={mockUser} />);
    expect(screen.getByText('Slack Clone')).toBeInTheDocument();
  });

  it('renders Channels section header', () => {
    render(<Sidebar channels={mockChannels} dms={[]} currentUser={mockUser} />);
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('renders all channels with # prefix', () => {
    render(<Sidebar channels={mockChannels} dms={[]} currentUser={mockUser} />);
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
    expect(screen.getAllByText('#')).toHaveLength(2);
  });

  it('calls setCurrentChannel when clicking a channel', async () => {
    const user = userEvent.setup();
    render(<Sidebar channels={mockChannels} dms={[]} currentUser={mockUser} />);

    await user.click(screen.getByText('general'));

    expect(mockSetCurrentChannel).toHaveBeenCalledWith('channel-1');
  });

  it('renders Direct Messages section header', () => {
    render(<Sidebar channels={[]} dms={mockDMs} currentUser={mockUser} />);
    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
  });

  it('renders DM with other participants name', () => {
    render(<Sidebar channels={[]} dms={mockDMs} currentUser={mockUser} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('calls setCurrentDM when clicking a DM', async () => {
    const user = userEvent.setup();
    render(<Sidebar channels={[]} dms={mockDMs} currentUser={mockUser} />);

    await user.click(screen.getByText('Alice Smith'));

    expect(mockSetCurrentDM).toHaveBeenCalledWith('dm-1');
  });

  it('renders current user display name in footer', () => {
    render(<Sidebar channels={[]} dms={[]} currentUser={mockUser} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders user avatar with first letter of display name', () => {
    render(<Sidebar channels={[]} dms={[]} currentUser={mockUser} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders ? avatar when user has no displayName', () => {
    const userWithoutName = { ...mockUser, displayName: '' };
    render(<Sidebar channels={[]} dms={[]} currentUser={userWithoutName} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    render(<Sidebar channels={[]} dms={[]} currentUser={mockUser} />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('calls logout when clicking logout button', async () => {
    const user = userEvent.setup();
    render(<Sidebar channels={[]} dms={[]} currentUser={mockUser} />);

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('shows Unknown for DMs without participants', () => {
    const dmWithoutParticipants: DirectMessage[] = [
      {
        id: 'dm-2',
        type: 'dm',
        participantIds: ['user-1', 'user-3'],
        participants: undefined,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    render(<Sidebar channels={[]} dms={dmWithoutParticipants} currentUser={mockUser} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
