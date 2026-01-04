import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChannel } from '../../api/channels';
import type { CreateChannelInput } from '../../api/channels';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateChannelModal({ isOpen, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (input: CreateChannelInput) => createChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      handleClose();
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error || 'Failed to create channel');
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    setIsPrivate(false);
    setError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmedName) {
      setError('Channel name is required');
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Channel name must be 2-80 characters');
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      type: isPrivate ? 'private' : 'public',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--slack-bg)] rounded-lg shadow-xl w-full max-w-md mx-4 border border-[var(--slack-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--slack-border)]">
          <h2 className="text-lg font-semibold text-white">Create a channel</h2>
          <button
            onClick={handleClose}
            className="text-[var(--slack-text-muted)] hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--slack-text-muted)] mb-2">
              Name
            </label>
            <div className="flex items-center bg-[var(--slack-hover)] rounded border border-[var(--slack-border)] focus-within:border-[var(--slack-active)]">
              <span className="pl-3 text-[var(--slack-text-muted)]">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. plan-budget"
                className="flex-1 bg-transparent px-2 py-2 text-white placeholder-[var(--slack-text-muted)] focus:outline-none"
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-[var(--slack-text-muted)]">
              Names must be lowercase, without spaces or periods.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--slack-text-muted)] mb-2">
              Description <span className="text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full bg-[var(--slack-hover)] rounded border border-[var(--slack-border)] px-3 py-2 text-white placeholder-[var(--slack-text-muted)] focus:outline-none focus:border-[var(--slack-active)]"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--slack-border)] bg-[var(--slack-hover)] text-[var(--slack-active)] focus:ring-[var(--slack-active)]"
              />
              <div>
                <span className="text-white text-sm">Make private</span>
                <p className="text-xs text-[var(--slack-text-muted)]">
                  Only invited members can see and join this channel.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-white bg-transparent border border-[var(--slack-border)] rounded hover:bg-[var(--slack-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="px-4 py-2 text-sm text-white bg-[var(--slack-active)] rounded hover:bg-[var(--slack-active)]/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
