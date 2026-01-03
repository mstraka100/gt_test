import { v4 as uuidv4 } from 'uuid';
import { Channel, CreateChannelInput, UpdateChannelInput, ChannelMember } from '../types';

// In-memory storage
const channels: Map<string, Channel> = new Map();
const channelsByName: Map<string, string> = new Map();
const channelMembers: Map<string, ChannelMember[]> = new Map(); // channelId -> members

export async function createChannel(
  input: CreateChannelInput,
  creatorId: string
): Promise<Channel> {
  const normalizedName = input.name.toLowerCase().replace(/\s+/g, '-');

  if (channelsByName.has(normalizedName)) {
    throw new Error('Channel name already exists');
  }

  // Validate channel name
  const nameRegex = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;
  if (!nameRegex.test(normalizedName) && normalizedName.length < 2) {
    throw new Error('Invalid channel name');
  }

  const channel: Channel = {
    id: uuidv4(),
    name: normalizedName,
    description: input.description,
    type: input.type || 'public',
    creatorId,
    memberIds: [creatorId],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  channels.set(channel.id, channel);
  channelsByName.set(normalizedName, channel.id);

  // Add creator as owner
  const member: ChannelMember = {
    channelId: channel.id,
    userId: creatorId,
    role: 'owner',
    joinedAt: new Date(),
  };
  channelMembers.set(channel.id, [member]);

  return channel;
}

export async function findChannelById(id: string): Promise<Channel | null> {
  return channels.get(id) || null;
}

export async function findChannelByName(name: string): Promise<Channel | null> {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  const channelId = channelsByName.get(normalizedName);
  if (!channelId) return null;
  return channels.get(channelId) || null;
}

export async function updateChannel(
  id: string,
  input: UpdateChannelInput,
  userId: string
): Promise<Channel | null> {
  const channel = channels.get(id);
  if (!channel) return null;

  // Check if user has permission (owner or admin)
  const members = channelMembers.get(id) || [];
  const userMember = members.find((m) => m.userId === userId);
  if (!userMember || (userMember.role !== 'owner' && userMember.role !== 'admin')) {
    throw new Error('Permission denied');
  }

  // Handle name change
  if (input.name && input.name !== channel.name) {
    const normalizedName = input.name.toLowerCase().replace(/\s+/g, '-');
    if (channelsByName.has(normalizedName)) {
      throw new Error('Channel name already exists');
    }
    channelsByName.delete(channel.name);
    channelsByName.set(normalizedName, id);
    channel.name = normalizedName;
  }

  if (input.description !== undefined) {
    channel.description = input.description;
  }

  channel.updatedAt = new Date();
  channels.set(id, channel);

  return channel;
}

export async function deleteChannel(id: string, userId: string): Promise<boolean> {
  const channel = channels.get(id);
  if (!channel) return false;

  // Only owner can delete
  const members = channelMembers.get(id) || [];
  const userMember = members.find((m) => m.userId === userId);
  if (!userMember || userMember.role !== 'owner') {
    throw new Error('Only channel owner can delete');
  }

  channelsByName.delete(channel.name);
  channels.delete(id);
  channelMembers.delete(id);

  return true;
}

export async function listChannels(userId: string): Promise<Channel[]> {
  const allChannels = Array.from(channels.values());

  // Return public channels and private channels user is a member of
  return allChannels.filter((channel) => {
    if (channel.type === 'public') return true;
    return channel.memberIds.includes(userId);
  });
}

export async function addMember(
  channelId: string,
  userId: string,
  addedBy: string,
  role: ChannelMember['role'] = 'member'
): Promise<ChannelMember> {
  const channel = channels.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  // Check if adding user has permission
  const members = channelMembers.get(channelId) || [];
  const adder = members.find((m) => m.userId === addedBy);

  // For private channels, must be member to add others
  if (channel.type === 'private') {
    if (!adder) {
      throw new Error('Permission denied');
    }
  }

  // Check if user is already a member
  if (channel.memberIds.includes(userId)) {
    throw new Error('User is already a member');
  }

  const member: ChannelMember = {
    channelId,
    userId,
    role,
    joinedAt: new Date(),
  };

  channel.memberIds.push(userId);
  channel.updatedAt = new Date();
  channels.set(channelId, channel);

  members.push(member);
  channelMembers.set(channelId, members);

  return member;
}

export async function removeMember(
  channelId: string,
  userId: string,
  removedBy: string
): Promise<boolean> {
  const channel = channels.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  const members = channelMembers.get(channelId) || [];
  const remover = members.find((m) => m.userId === removedBy);
  const toRemove = members.find((m) => m.userId === userId);

  if (!toRemove) {
    throw new Error('User is not a member');
  }

  // Users can remove themselves, or admins/owners can remove others
  if (removedBy !== userId) {
    if (!remover || (remover.role !== 'owner' && remover.role !== 'admin')) {
      throw new Error('Permission denied');
    }
    // Owners cannot be removed by admins
    if (toRemove.role === 'owner') {
      throw new Error('Cannot remove channel owner');
    }
  }

  // Owner cannot leave without transferring ownership
  if (toRemove.role === 'owner' && userId === removedBy) {
    throw new Error('Owner must transfer ownership before leaving');
  }

  channel.memberIds = channel.memberIds.filter((id) => id !== userId);
  channel.updatedAt = new Date();
  channels.set(channelId, channel);

  const updatedMembers = members.filter((m) => m.userId !== userId);
  channelMembers.set(channelId, updatedMembers);

  return true;
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  return channelMembers.get(channelId) || [];
}

export async function isMember(channelId: string, userId: string): Promise<boolean> {
  const channel = channels.get(channelId);
  if (!channel) return false;
  return channel.memberIds.includes(userId);
}

export async function joinPublicChannel(channelId: string, userId: string): Promise<ChannelMember> {
  const channel = channels.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  if (channel.type !== 'public') {
    throw new Error('Cannot join private channel without invitation');
  }

  if (channel.memberIds.includes(userId)) {
    throw new Error('Already a member');
  }

  const member: ChannelMember = {
    channelId,
    userId,
    role: 'member',
    joinedAt: new Date(),
  };

  channel.memberIds.push(userId);
  channel.updatedAt = new Date();
  channels.set(channelId, channel);

  const members = channelMembers.get(channelId) || [];
  members.push(member);
  channelMembers.set(channelId, members);

  return member;
}
