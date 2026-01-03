interface Props {
  status: 'active' | 'away' | 'dnd' | 'offline';
  className?: string;
}

export function PresenceDot({ status, className = '' }: Props) {
  const colors = {
    active: 'bg-green-500',
    away: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  return (
    <div 
      className={`w-2.5 h-2.5 rounded-full border-2 ${colors[status]} ${className}`}
      style={{ borderColor: 'var(--slack-sidebar)' }}
    />
  );
}
