import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import { getCurrentUser } from './api/auth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--slack-bg)]">
        <div className="text-[var(--slack-text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthLoader({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUser()
        .then(setUser)
        .catch(() => logout());
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, setUser, setLoading, logout]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthLoader>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <WorkspacePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthLoader>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
