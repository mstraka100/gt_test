import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageItem } from './MessageItem';
import { mockMessage, mockMessageWithLink, mockMessageWithFiles, mockUser } from '../../test/mocks';

describe('MessageItem', () => {
  it('renders message content', () => {
    render(<MessageItem message={mockMessage} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('displays user display name', () => {
    render(<MessageItem message={mockMessage} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows avatar with first letter of display name', () => {
    render(<MessageItem message={mockMessage} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('shows "Unknown" when user is missing', () => {
    const messageWithoutUser = { ...mockMessage, user: undefined };
    render(<MessageItem message={messageWithoutUser} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows "?" avatar when user has no displayName', () => {
    const messageWithEmptyUser = {
      ...mockMessage,
      user: { ...mockUser, displayName: '' },
    };
    render(<MessageItem message={messageWithEmptyUser} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('hides avatar when showAvatar is false', () => {
    render(<MessageItem message={mockMessage} showAvatar={false} />);
    expect(screen.queryByText('T')).not.toBeInTheDocument();
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
  });

  it('still shows message content when avatar is hidden', () => {
    render(<MessageItem message={mockMessage} showAvatar={false} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders URLs as clickable links', () => {
    render(<MessageItem message={mockMessageWithLink} />);
    const link = screen.getByRole('link', { name: /example.com/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('prepends https:// to www URLs', () => {
    const messageWithWwwUrl = {
      ...mockMessage,
      content: 'Check out www.example.com',
    };
    render(<MessageItem message={messageWithWwwUrl} />);
    const link = screen.getByRole('link', { name: /www.example.com/i });
    expect(link).toHaveAttribute('href', 'https://www.example.com');
  });

  it('displays file attachments', () => {
    render(<MessageItem message={mockMessageWithFiles} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    // Image files show in the preview section
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();
  });

  it('displays file size in KB format', () => {
    render(<MessageItem message={mockMessageWithFiles} />);
    // The PDF file is 50KB
    expect(screen.getByText(/50\.0 KB/)).toBeInTheDocument();
  });

  it('displays file size for image files', () => {
    render(<MessageItem message={mockMessageWithFiles} />);
    // The image file is 200KB - it appears in the image preview
    expect(screen.getByText(/200\.0 KB/)).toBeInTheDocument();
  });

  it('renders images as clickable previews', () => {
    render(<MessageItem message={mockMessageWithFiles} />);
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
  });

  it('does not render file section when no files', () => {
    render(<MessageItem message={mockMessage} />);
    expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
  });
});
