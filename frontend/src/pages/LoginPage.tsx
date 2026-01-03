import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { login } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user, accessToken, refreshToken } = await login({ email, password });
      authLogin(user, accessToken, refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--slack-bg)]">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Sign in to Slack</h1>
          <p className="text-[var(--slack-text-muted)]">
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--slack-text)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--slack-hover)] border border-[var(--slack-border)] rounded text-white placeholder-[var(--slack-text-muted)] focus:outline-none focus:border-[var(--slack-active)]"
              placeholder="name@work-email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--slack-text)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--slack-hover)] border border-[var(--slack-border)] rounded text-white placeholder-[var(--slack-text-muted)] focus:outline-none focus:border-[var(--slack-active)]"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--slack-purple)] hover:bg-[#4a154b] text-white font-medium rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-[var(--slack-text-muted)]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--slack-active)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
