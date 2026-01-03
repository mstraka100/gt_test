import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createWorkspace,
  findWorkspaceById,
  findWorkspaceBySlug,
  updateWorkspace,
  deleteWorkspace,
  listUserWorkspaces,
  addMember,
  removeMember,
  getWorkspaceMembers,
  getMemberRole,
  updateMemberRole,
  transferOwnership,
} from '../models/workspace';
import { findUserById, findUserByEmail } from '../models/user';
import { CreateWorkspaceInput, UpdateWorkspaceInput, InviteToWorkspaceInput } from '../types';

const router = Router();

// All workspace routes require authentication
router.use(authenticate);

// POST /workspaces - Create a new workspace
router.post('/', async (req: Request, res: Response) => {
  try {
    const input: CreateWorkspaceInput = req.body;

    if (!input.name || input.name.trim().length === 0) {
      res.status(400).json({ error: 'Workspace name is required' });
      return;
    }

    if (input.name.length > 100) {
      res.status(400).json({ error: 'Workspace name must be 100 characters or less' });
      return;
    }

    const workspace = await createWorkspace(input, req.user!.id);
    res.status(201).json({ workspace });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /workspaces - List user's workspaces
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaces = await listUserWorkspaces(req.user!.id);
    res.json({ workspaces });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /workspaces/:id - Get workspace by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is a member
    const role = await getMemberRole(workspace.id, req.user!.id);
    if (!role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ workspace, role });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /workspaces/slug/:slug - Get workspace by slug
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const workspace = await findWorkspaceBySlug(req.params.slug);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is a member
    const role = await getMemberRole(workspace.id, req.user!.id);
    if (!role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ workspace, role });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /workspaces/:id - Update workspace
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const input: UpdateWorkspaceInput = req.body;
    const workspace = await updateWorkspace(req.params.id, input, req.user!.id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    res.json({ workspace });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /workspaces/:id - Delete workspace
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteWorkspace(req.params.id, req.user!.id);

    if (!deleted) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Only workspace owner can delete') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /workspaces/:id/members - Get workspace members
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const workspace = await findWorkspaceById(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is a member
    const role = await getMemberRole(workspace.id, req.user!.id);
    if (!role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const members = await getWorkspaceMembers(workspace.id);
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /workspaces/:id/members - Add member to workspace (invite)
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const input: InviteToWorkspaceInput = req.body;

    if (!input.email && !input.userId) {
      res.status(400).json({ error: 'Either email or userId is required' });
      return;
    }

    let userId = input.userId;
    if (input.email && !userId) {
      const user = await findUserByEmail(input.email);
      if (!user) {
        res.status(404).json({ error: 'User with this email not found' });
        return;
      }
      userId = user.id;
    }

    const member = await addMember(
      req.params.id,
      userId!,
      req.user!.id,
      input.role || 'member'
    );

    res.status(201).json({ member });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Workspace not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error.message === 'Permission denied' ||
        error.message === 'User is already a member' ||
        error.message === 'Cannot add user as owner'
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /workspaces/:id/members/:userId - Remove member from workspace
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    await removeMember(req.params.id, req.params.userId, req.user!.id);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Workspace not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error.message === 'Permission denied' ||
        error.message === 'User is not a member' ||
        error.message === 'Cannot remove workspace owner' ||
        error.message === 'Owner must transfer ownership before leaving'
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /workspaces/:id/members/:userId - Update member role
router.patch('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;

    if (!role || !['admin', 'member'].includes(role)) {
      res.status(400).json({ error: 'Valid role (admin or member) is required' });
      return;
    }

    const member = await updateMemberRole(
      req.params.id,
      req.params.userId,
      role,
      req.user!.id
    );

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ member });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Workspace not found' ||
        error.message === 'User is not a member'
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error.message === 'Only workspace owner can change roles' ||
        error.message === 'Use transfer ownership to change owner' ||
        error.message === 'Use transfer ownership to promote to owner'
      ) {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /workspaces/:id/transfer-ownership - Transfer workspace ownership
router.post('/:id/transfer-ownership', async (req: Request, res: Response) => {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      res.status(400).json({ error: 'newOwnerId is required' });
      return;
    }

    await transferOwnership(req.params.id, newOwnerId, req.user!.id);
    res.json({ message: 'Ownership transferred successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Workspace not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error.message === 'Only current owner can transfer ownership' ||
        error.message === 'New owner must be a workspace member'
      ) {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /workspaces/:id/leave - Leave workspace (self-removal)
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    await removeMember(req.params.id, req.user!.id, req.user!.id);
    res.json({ message: 'Left workspace successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Workspace not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error.message === 'User is not a member' ||
        error.message === 'Owner must transfer ownership before leaving'
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
