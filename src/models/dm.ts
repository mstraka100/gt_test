import { v4 as uuidv4 } from 'uuid';
import { DirectMessage, DMMessage } from '../types';

// In-memory storage
const dms: Map<string, DirectMessage> = new Map();
const dmMessages: Map<string, string[]> = new Map(); // dmId -> messageIds
const messages: Map<string, DMMessage> = new Map();
const userDMs: Map<string, Set<string>> = new Map(); // userId -> Set of dmIds

// Helper to generate a consistent key for 1:1 DMs
function getDMKey(userIds: string[]): string {
  return [...userIds].sort().join(':');
}

const dmByParticipants: Map<string, string> = new Map(); // sorted participant key -> dmId

export async function findOrCreateDM(
  participantIds: string[],
  creatorId: string
): Promise<DirectMessage> {
  // Ensure creator is in participant list
  if (!participantIds.includes(creatorId)) {
    participantIds = [...participantIds, creatorId];
  }

  // Remove duplicates
  participantIds = [...new Set(participantIds)];

  if (participantIds.length < 2) {
    throw new Error('DM requires at least 2 participants');
  }

  // For 1:1 DMs, check if one already exists
  if (participantIds.length === 2) {
    const key = getDMKey(participantIds);
    const existingId = dmByParticipants.get(key);
    if (existingId) {
      return dms.get(existingId)!;
    }
  }

  const dm: DirectMessage = {
    id: uuidv4(),
    type: participantIds.length === 2 ? 'dm' : 'group_dm',
    participantIds,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  dms.set(dm.id, dm);
  dmMessages.set(dm.id, []);

  // Track for 1:1 lookup
  if (participantIds.length === 2) {
    dmByParticipants.set(getDMKey(participantIds), dm.id);
  }

  // Track per-user
  for (const userId of participantIds) {
    if (!userDMs.has(userId)) {
      userDMs.set(userId, new Set());
    }
    userDMs.get(userId)!.add(dm.id);
  }

  return dm;
}

export async function findDMById(id: string): Promise<DirectMessage | null> {
  return dms.get(id) || null;
}

export async function findDMBetweenUsers(userIds: string[]): Promise<DirectMessage | null> {
  if (userIds.length !== 2) return null;
  const key = getDMKey(userIds);
  const dmId = dmByParticipants.get(key);
  if (!dmId) return null;
  return dms.get(dmId) || null;
}

export async function getUserDMs(userId: string): Promise<DirectMessage[]> {
  const dmIds = userDMs.get(userId);
  if (!dmIds) return [];

  const result: DirectMessage[] = [];
  for (const dmId of dmIds) {
    const dm = dms.get(dmId);
    if (dm) result.push(dm);
  }

  // Sort by last message time (most recent first)
  return result.sort((a, b) => {
    const aTime = a.lastMessageAt?.getTime() || a.createdAt.getTime();
    const bTime = b.lastMessageAt?.getTime() || b.createdAt.getTime();
    return bTime - aTime;
  });
}

export async function isParticipant(dmId: string, userId: string): Promise<boolean> {
  const dm = dms.get(dmId);
  if (!dm) return false;
  return dm.participantIds.includes(userId);
}

export async function createDMMessage(params: {
  dmId: string;
  userId: string;
  content: string;
}): Promise<DMMessage> {
  const dm = dms.get(params.dmId);
  if (!dm) {
    throw new Error('DM not found');
  }

  const message: DMMessage = {
    id: uuidv4(),
    dmId: params.dmId,
    userId: params.userId,
    content: params.content,
    type: 'text',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  messages.set(message.id, message);

  // Add to DM message list
  dmMessages.get(params.dmId)!.push(message.id);

  // Update DM last message time
  dm.lastMessageAt = new Date();
  dm.updatedAt = new Date();
  dms.set(params.dmId, dm);

  return message;
}

export async function getDMMessages(
  dmId: string,
  limit: number = 50,
  before?: string
): Promise<DMMessage[]> {
  const messageIds = dmMessages.get(dmId) || [];

  let startIndex = messageIds.length;

  if (before) {
    const beforeIndex = messageIds.indexOf(before);
    if (beforeIndex !== -1) {
      startIndex = beforeIndex;
    }
  }

  const start = Math.max(0, startIndex - limit);
  const selectedIds = messageIds.slice(start, startIndex);

  return selectedIds
    .map((id) => messages.get(id))
    .filter((m): m is DMMessage => m !== undefined);
}

export async function findDMMessageById(id: string): Promise<DMMessage | null> {
  return messages.get(id) || null;
}

export async function updateDMMessage(
  id: string,
  userId: string,
  content: string
): Promise<DMMessage | null> {
  const message = messages.get(id);
  if (!message) return null;

  if (message.userId !== userId) {
    throw new Error('Permission denied');
  }

  message.content = content;
  message.updatedAt = new Date();
  message.editedAt = new Date();

  messages.set(id, message);
  return message;
}

export async function deleteDMMessage(id: string, userId: string): Promise<boolean> {
  const message = messages.get(id);
  if (!message) return false;

  if (message.userId !== userId) {
    throw new Error('Permission denied');
  }

  messages.delete(id);

  const msgList = dmMessages.get(message.dmId);
  if (msgList) {
    const index = msgList.indexOf(id);
    if (index !== -1) {
      msgList.splice(index, 1);
    }
  }

  return true;
}

export async function addParticipant(dmId: string, userId: string): Promise<DirectMessage | null> {
  const dm = dms.get(dmId);
  if (!dm) return null;

  if (dm.type !== 'group_dm') {
    throw new Error('Cannot add participants to 1:1 DM');
  }

  if (dm.participantIds.includes(userId)) {
    throw new Error('User is already a participant');
  }

  dm.participantIds.push(userId);
  dm.updatedAt = new Date();
  dms.set(dmId, dm);

  if (!userDMs.has(userId)) {
    userDMs.set(userId, new Set());
  }
  userDMs.get(userId)!.add(dmId);

  return dm;
}

export async function leaveGroupDM(dmId: string, userId: string): Promise<boolean> {
  const dm = dms.get(dmId);
  if (!dm) return false;

  if (dm.type !== 'group_dm') {
    throw new Error('Cannot leave 1:1 DM');
  }

  if (!dm.participantIds.includes(userId)) {
    throw new Error('Not a participant');
  }

  dm.participantIds = dm.participantIds.filter((id) => id !== userId);
  dm.updatedAt = new Date();
  dms.set(dmId, dm);

  userDMs.get(userId)?.delete(dmId);

  return true;
}
