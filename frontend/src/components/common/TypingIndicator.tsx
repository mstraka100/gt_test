interface Props {
  usernames: string[];
}

export function TypingIndicator({ usernames }: Props) {
  if (usernames.length === 0) return null;

  let text: string;
  if (usernames.length === 1) {
    text = `${usernames[0]} is typing...`;
  } else if (usernames.length === 2) {
    text = `${usernames[0]} and ${usernames[1]} are typing...`;
  } else {
    text = `${usernames.length} people are typing...`;
  }

  return (
    <div className="px-4 py-1 text-xs italic" style={{ color: 'var(--slack-text-muted)' }}>
      {text}
    </div>
  );
}
