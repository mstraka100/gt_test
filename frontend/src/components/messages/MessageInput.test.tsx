import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from './MessageInput';

vi.mock('../../api/files', () => ({
  uploadFile: vi.fn(),
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },
  isImageFile: (mimeType: string) => mimeType.startsWith('image/'),
}));

describe('MessageInput', () => {
  const mockOnSend = vi.fn();
  const mockOnTyping = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with placeholder text', () => {
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);
    expect(screen.getByPlaceholderText('Type a message')).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('allows typing in the textarea', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message');
    await user.type(textarea, 'Hello world');

    expect(textarea).toHaveValue('Hello world');
  });

  it('calls onSend with message content when submitting', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    await user.type(screen.getByPlaceholderText('Type a message'), 'Hello world');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith('Hello world', undefined);
  });

  it('clears input after sending', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message');
    await user.type(textarea, 'Hello world');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(textarea).toHaveValue('');
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message');
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnSend).toHaveBeenCalledWith('Hello world', undefined);
  });

  it('does not submit on Shift+Enter (allows newline)', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    const textarea = screen.getByPlaceholderText('Type a message');
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    expect(mockOnSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Line 1\nLine 2');
  });

  it('does not send empty messages', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    await user.type(screen.getByPlaceholderText('Type a message'), '   ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('trims message content before sending', async () => {
    const user = userEvent.setup();
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);

    await user.type(screen.getByPlaceholderText('Type a message'), '  Hello  ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith('Hello', undefined);
  });

  it('calls onTyping when user types', async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        placeholder="Type a message"
        onSend={mockOnSend}
        onTyping={mockOnTyping}
      />
    );

    await user.type(screen.getByPlaceholderText('Type a message'), 'H');

    expect(mockOnTyping).toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    render(
      <MessageInput
        placeholder="Type a message"
        onSend={mockOnSend}
        disabled={true}
      />
    );

    expect(screen.getByPlaceholderText('Type a message')).toBeDisabled();
  });

  it('disables send button when disabled prop is true', () => {
    render(
      <MessageInput
        placeholder="Type a message"
        onSend={mockOnSend}
        disabled={true}
      />
    );

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('has attach files button', () => {
    render(<MessageInput placeholder="Type a message" onSend={mockOnSend} />);
    expect(screen.getByTitle('Attach files')).toBeInTheDocument();
  });
});
