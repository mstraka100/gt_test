import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from './TypingIndicator';

describe('TypingIndicator', () => {
  it('returns null when no users are typing', () => {
    const { container } = render(<TypingIndicator usernames={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows singular form for one user typing', () => {
    render(<TypingIndicator usernames={['Alice']} />);
    expect(screen.getByText('Alice is typing...')).toBeInTheDocument();
  });

  it('shows "and" form for two users typing', () => {
    render(<TypingIndicator usernames={['Alice', 'Bob']} />);
    expect(screen.getByText('Alice and Bob are typing...')).toBeInTheDocument();
  });

  it('shows count form for three or more users typing', () => {
    render(<TypingIndicator usernames={['Alice', 'Bob', 'Charlie']} />);
    expect(screen.getByText('3 people are typing...')).toBeInTheDocument();
  });

  it('shows count form for many users typing', () => {
    render(<TypingIndicator usernames={['Alice', 'Bob', 'Charlie', 'Dave', 'Eve']} />);
    expect(screen.getByText('5 people are typing...')).toBeInTheDocument();
  });

  it('has italic styling', () => {
    render(<TypingIndicator usernames={['Alice']} />);
    const indicator = screen.getByText('Alice is typing...');
    expect(indicator).toHaveClass('italic');
    expect(indicator).toHaveClass('text-xs');
  });
});
