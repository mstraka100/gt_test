import { v4 as uuidv4 } from 'uuid';
import {
  Workspace,
  WorkspaceMember,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '../types';

// In-memory storage
const workspaces: Map<string, Workspace> = new Map();
const workspacesBySlug: Map<string, string> = new Map();
const workspaceMembers: Map<string, WorkspaceMember[]> = new Map(); // workspaceId -> members
const userWorkspaces: Map<string, string[]> = new Map(); // userId -> workspaceIds

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function ensureUniqueSlug(baseSlug: string): string {
  let slug = baseSlug;
  let counter = 1;
  while (workspacesBySlug.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
  ownerId: string
): Promise<Workspace> {
  const baseSlug = input.slug || generateSlug(input.name);
  const slug = ensureUniqueSlug(baseSlug);

  const workspace: Workspace = {
    id: uuidv4(),
    name: input.name,
    slug,
    description: input.description,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  workspaces.set(workspace.id, workspace);
  workspacesBySlug.set(slug, workspace.id);

  // Add owner as member
  const member: WorkspaceMember = {
    workspaceId: workspace.id,
    userId: ownerId,
    role: 'owner',
    joinedAt: new Date(),
  };
  workspaceMembers.set(workspace.id, [member]);

  // Track user's workspaces
  const userWsList = userWorkspaces.get(ownerId) || [];
  userWsList.push(workspace.id);
  userWorkspaces.set(ownerId, userWsList);

  return workspace;
}

export async function findWorkspaceById(id: string): Promise<Workspace | null> {
  return workspaces.get(id) || null;
}

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const workspaceId = workspacesBySlug.get(slug.toLowerCase());
  if (!workspaceId) return null;
  return workspaces.get(workspaceId) || null;
}

export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput,
  userId: string
): Promise<Workspace | null> {
  const workspace = workspaces.get(id);
  if (!workspace) return null;

  // Check if user has permission (owner or admin)
  const members = workspaceMembers.get(id) || [];
  const userMember = members.find((m) => m.userId === userId);
  if (!userMember || (userMember.role !== 'owner' && userMember.role !== 'admin')) {
    throw new Error('Permission denied');
  }

  if (input.name !== undefined) {
    workspace.name = input.name;
  }
  if (input.description !== undefined) {
    workspace.description = input.description;
  }

  workspace.updatedAt = new Date();
  workspaces.set(id, workspace);

  return workspace;
}

export async function deleteWorkspace(id: string, userId: string): Promise<boolean> {
  const workspace = workspaces.get(id);
  if (!workspace) return false;

  // Only owner can delete
  if (workspace.ownerId !== userId) {
    throw new Error('Only workspace owner can delete');
  }

  // Remove all members' references
  const members = workspaceMembers.get(id) || [];
  for (const member of members) {
    const userWsList = userWorkspaces.get(member.userId) || [];
    const filtered = userWsList.filter((wsId) => wsId !== id);
    userWorkspaces.set(member.userId, filtered);
  }

  workspacesBySlug.delete(workspace.slug);
  workspaces.delete(id);
  workspaceMembers.delete(id);

  return true;
}

export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
  const workspaceIds = userWorkspaces.get(userId) || [];
  const result: Workspace[] = [];
  for (const wsId of workspaceIds) {
    const ws = workspaces.get(wsId);
    if (ws) result.push(ws);
  }
  return result;
}

export async function addMember(
  workspaceId: string,
  userId: string,
  addedBy: string,
  role: WorkspaceMember['role'] = 'member'
): Promise<WorkspaceMember> {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  // Check if adding user has permission
  const members = workspaceMembers.get(workspaceId) || [];
  const adder = members.find((m) => m.userId === addedBy);
  if (!adder || (adder.role !== 'owner' && adder.role !== 'admin')) {
    throw new Error('Permission denied');
  }

  // Check if user is already a member
  const existingMember = members.find((m) => m.userId === userId);
  if (existingMember) {
    throw new Error('User is already a member');
  }

  // Cannot add someone as owner
  if (role === 'owner') {
    throw new Error('Cannot add user as owner');
  }

  const member: WorkspaceMember = {
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  };

  members.push(member);
  workspaceMembers.set(workspaceId, members);

  // Track user's workspaces
  const userWsList = userWorkspaces.get(userId) || [];
  userWsList.push(workspaceId);
  userWorkspaces.set(userId, userWsList);

  return member;
}

export async function removeMember(
  workspaceId: string,
  userId: string,
  removedBy: string
): Promise<boolean> {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const members = workspaceMembers.get(workspaceId) || [];
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
      throw new Error('Cannot remove workspace owner');
    }
  }

  // Owner cannot leave without transferring ownership
  if (toRemove.role === 'owner' && userId === removedBy) {
    throw new Error('Owner must transfer ownership before leaving');
  }

  const updatedMembers = members.filter((m) => m.userId !== userId);
  workspaceMembers.set(workspaceId, updatedMembers);

  // Remove from user's workspace list
  const userWsList = userWorkspaces.get(userId) || [];
  const filtered = userWsList.filter((wsId) => wsId !== workspaceId);
  userWorkspaces.set(userId, filtered);

  return true;
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return workspaceMembers.get(workspaceId) || [];
}

export async function getMemberRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember['role'] | null> {
  const members = workspaceMembers.get(workspaceId) || [];
  const member = members.find((m) => m.userId === userId);
  return member?.role || null;
}

export async function isMember(workspaceId: string, userId: string): Promise<boolean> {
  const members = workspaceMembers.get(workspaceId) || [];
  return members.some((m) => m.userId === userId);
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceMember['role'],
  updatedBy: string
): Promise<WorkspaceMember | null> {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const members = workspaceMembers.get(workspaceId) || [];
  const updater = members.find((m) => m.userId === updatedBy);
  const toUpdate = members.find((m) => m.userId === userId);

  if (!toUpdate) {
    throw new Error('User is not a member');
  }

  // Only owners can change roles
  if (!updater || updater.role !== 'owner') {
    throw new Error('Only workspace owner can change roles');
  }

  // Cannot change owner's role this way
  if (toUpdate.role === 'owner') {
    throw new Error('Use transfer ownership to change owner');
  }

  // Cannot promote to owner this way
  if (newRole === 'owner') {
    throw new Error('Use transfer ownership to promote to owner');
  }

  toUpdate.role = newRole;
  workspaceMembers.set(workspaceId, members);

  return toUpdate;
}

export async function transferOwnership(
  workspaceId: string,
  newOwnerId: string,
  currentOwnerId: string
): Promise<boolean> {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (workspace.ownerId !== currentOwnerId) {
    throw new Error('Only current owner can transfer ownership');
  }

  const members = workspaceMembers.get(workspaceId) || [];
  const newOwner = members.find((m) => m.userId === newOwnerId);
  const currentOwner = members.find((m) => m.userId === currentOwnerId);

  if (!newOwner) {
    throw new Error('New owner must be a workspace member');
  }

  // Update roles
  if (currentOwner) {
    currentOwner.role = 'admin';
  }
  newOwner.role = 'owner';

  workspace.ownerId = newOwnerId;
  workspace.updatedAt = new Date();

  workspaces.set(workspaceId, workspace);
  workspaceMembers.set(workspaceId, members);

  return true;
}
