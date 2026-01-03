import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthResponse } from '../types';
import { api, setAccessToken, setRefreshToken, getAccessToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      api.get<{ user: User }>('/auth/me')
        .then(({ user }) => setUser(user))
        .catch(() => {
          setAccessToken(null);
          setRefreshToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    setAccessToken(response.accessToken);
    setRefreshToken(response.refreshToken);
    setUser(response.user);
  };

  const register = async (email: string, username: string, password: string, displayName: string) => {
    const response = await api.post<AuthResponse>('/auth/register', {
      email,
      username,
      password,
      displayName,
    });
    setAccessToken(response.accessToken);
    setRefreshToken(response.refreshToken);
    setUser(response.user);
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
