import { formatDistanceToNow } from 'date-fns';
import type { Message, DMMessage, FileUpload } from '../../types';

// URL regex pattern - matches http://, https://, and www. URLs
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

// Parse text and convert URLs to clickable links
function renderWithLinks(content: string): React.ReactNode {
  const parts = content.split(URL_REGEX);
  const matches = content.match(URL_REGEX) || [];

  if (matches.length === 0) {
    return content;
  }

  const result: React.ReactNode[] = [];
  let matchIndex = 0;

  parts.forEach((part, index) => {
    if (part === matches[matchIndex]) {
      // This part is a URL
      const url = part.startsWith('www.') ? `https://${part}` : part;
      result.push(
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {part}
        </a>
      );
      matchIndex++;
    } else if (part) {
      // Regular text
      result.push(part);
    }
  });

  return result;
}

interface Props {
  message: Message | DMMessage;
  showAvatar?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function FilePreview({ file }: { file: FileUpload }) {
  const downloadUrl = `/api${file.url}`;

  if (isImageFile(file.mimeType)) {
    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-sm rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
        style={{ borderColor: 'var(--slack-border)' }}
      >
        <img
          src={downloadUrl}
          alt={file.originalName}
          className="max-w-full max-h-80 object-contain"
        />
        <div className="px-3 py-2 text-xs" style={{ backgroundColor: 'var(--slack-hover)', color: 'var(--slack-text-muted)' }}>
          {file.originalName} ({formatFileSize(file.size)})
        </div>
      </a>
    );
  }

  return (
    <a
      href={downloadUrl}
      download={file.originalName}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors max-w-sm"
      style={{ backgroundColor: 'var(--slack-hover)', border: '1px solid var(--slack-border)' }}
    >
      <div
        className="w-10 h-10 flex items-center justify-center rounded"
        style={{ backgroundColor: 'var(--slack-border)' }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--slack-text-muted)' }}>
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--slack-link)' }}>
          {file.originalName}
        </div>
        <div className="text-xs" style={{ color: 'var(--slack-text-muted)' }}>
          {formatFileSize(file.size)}
        </div>
      </div>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--slack-text-muted)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}

export function MessageItem({ message, showAvatar = true }: Props) {
  const user = message.user;
  const timestamp = new Date(message.createdAt);
  const files = message.files;

  return (
    <div className="px-5 py-1 flex gap-3 hover:bg-white/5 group">
      {showAvatar ? (
        <div
          className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center text-sm font-medium"
          style={{ backgroundColor: 'var(--slack-hover)', color: 'var(--slack-text)' }}
        >
          {user?.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
      ) : (
        <div className="w-9 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm" style={{ color: 'var(--slack-text)' }}>
              {user?.displayName || 'Unknown'}
            </span>
            <span className="text-xs" style={{ color: 'var(--slack-text-muted)' }}>
              {formatDistanceToNow(timestamp, { addSuffix: true })}
            </span>
          </div>
        )}
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--slack-text)' }}>
            {renderWithLinks(message.content)}
          </div>
        )}
        {files && files.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {files.map(file => (
              <FilePreview key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
