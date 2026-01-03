import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: Props) {
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ email, password });
      authLogin(response.user, response.accessToken, response.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--slack-bg)' }}>
      <div className="w-full max-w-md p-8 rounded-lg" style={{ backgroundColor: 'var(--slack-sidebar)' }}>
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Sign in to Slack</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded text-red-400 text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--slack-text)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded text-white outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: 'var(--slack-hover)', border: '1px solid var(--slack-border)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--slack-text)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded text-white outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: 'var(--slack-hover)', border: '1px solid var(--slack-border)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--slack-active)' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: 'var(--slack-text-muted)' }}>
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-blue-400 hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
