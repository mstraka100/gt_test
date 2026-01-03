import { useState, useRef, useEffect } from 'react';

interface Props {
  placeholder: string;
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
}

export function MessageInput({ placeholder, onSend, onTyping, disabled }: Props) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || disabled) return;
    
    onSend(content.trim());
    setContent('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
    
    // Typing indicator
    if (onTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping();
      typingTimeoutRef.current = setTimeout(() => {}, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4">
      <div 
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--slack-hover)', border: '1px solid var(--slack-border)' }}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-3 py-2 bg-transparent text-white resize-none outline-none text-sm"
          style={{ minHeight: '40px', maxHeight: '200px' }}
        />
        <div className="flex items-center justify-between px-3 py-1.5 border-t" style={{ borderColor: 'var(--slack-border)' }}>
          <div className="flex items-center gap-2">
            {/* Placeholder for formatting buttons */}
          </div>
          <button
            type="submit"
            disabled={!content.trim() || disabled}
            className="px-3 py-1 rounded text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: content.trim() ? 'var(--slack-active)' : 'var(--slack-border)',
              color: content.trim() ? 'white' : 'var(--slack-text-muted)',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
