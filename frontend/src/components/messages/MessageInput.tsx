import { useState, useRef, useEffect } from 'react';
import { uploadFile, formatFileSize, isImageFile } from '../../api/files';
import type { FileUpload } from '../../types';

interface Props {
  placeholder: string;
  onSend: (content: string, files?: FileUpload[]) => void;
  onTyping?: () => void;
  disabled?: boolean;
  channelId?: string;
  dmId?: string;
}

export function MessageInput({ placeholder, onSend, onTyping, disabled, channelId, dmId }: Props) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<FileUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!content.trim() && pendingFiles.length === 0) || disabled || uploading) return;

    onSend(content.trim(), pendingFiles.length > 0 ? pendingFiles : undefined);
    setContent('');
    setPendingFiles([]);
    setUploadError(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      const uploadPromises = Array.from(files).map(file =>
        uploadFile({ file, channelId, dmId })
      );
      const uploaded = await Promise.all(uploadPromises);
      setPendingFiles(prev => [...prev, ...uploaded]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const canSend = (content.trim() || pendingFiles.length > 0) && !uploading;

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4">
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--slack-hover)', border: '1px solid var(--slack-border)' }}
            >
              {isImageFile(file.mimeType) ? (
                <img
                  src={`/api${file.url}`}
                  alt={file.originalName}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center rounded" style={{ backgroundColor: 'var(--slack-border)' }}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--slack-text-muted)' }}>
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ color: 'var(--slack-text)' }}>{file.originalName}</div>
                <div style={{ color: 'var(--slack-text-muted)' }}>{formatFileSize(file.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="p-1 rounded hover:bg-white/10"
                style={{ color: 'var(--slack-text-muted)' }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-2 px-3 py-2 rounded text-sm text-red-400 bg-red-900/20">
          {uploadError}
        </div>
      )}

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
          disabled={disabled || uploading}
          rows={1}
          className="w-full px-3 py-2 bg-transparent text-white resize-none outline-none text-sm"
          style={{ minHeight: '40px', maxHeight: '200px' }}
        />
        <div className="flex items-center justify-between px-3 py-1.5 border-t" style={{ borderColor: 'var(--slack-border)' }}>
          <div className="flex items-center gap-2">
            {/* File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.txt,.csv,.json,.zip"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--slack-text-muted)' }}
              title="Attach files"
            >
              {uploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={!canSend || disabled}
            className="px-3 py-1 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: canSend ? 'var(--slack-active)' : 'var(--slack-border)',
              color: canSend ? 'white' : 'var(--slack-text-muted)',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
