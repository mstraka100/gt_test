import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PresenceDot } from './PresenceDot';

describe('PresenceDot', () => {
  it('renders with active status (green)', () => {
    const { container } = render(<PresenceDot status="active" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('bg-green-500');
  });

  it('renders with away status (yellow)', () => {
    const { container } = render(<PresenceDot status="away" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('bg-yellow-500');
  });

  it('renders with dnd status (red)', () => {
    const { container } = render(<PresenceDot status="dnd" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('bg-red-500');
  });

  it('renders with offline status (gray)', () => {
    const { container } = render(<PresenceDot status="offline" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('bg-gray-500');
  });

  it('applies custom className', () => {
    const { container } = render(<PresenceDot status="active" className="custom-class" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('custom-class');
  });

  it('has rounded styling', () => {
    const { container } = render(<PresenceDot status="active" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveClass('rounded-full');
    expect(dot).toHaveClass('w-2.5');
    expect(dot).toHaveClass('h-2.5');
  });
});
