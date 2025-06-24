import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthUser extends User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // Set the token in the API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token is still valid by fetching user info
          const response = await api.get('/auth/me');
          const userData = response.data;
          
          // Set user data - ensure role is properly typed
          const typedUser: User = {
            id: userData.id,
            displayName: userData.displayName,
            email: userData.email,
            role: userData.role as 'admin' | 'editor' | 'viewer'
          };
          setUser(typedUser);
        } catch (err) {
          // Token is invalid, remove it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { accessToken, refreshToken, user: userData } = response.data;

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Set authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // Set user data - ensure role is properly typed
      const typedUser: User = {
        id: userData.id,
        displayName: userData.displayName,
        email: userData.email,
        role: userData.role as 'admin' | 'editor' | 'viewer'
      };
      setUser(typedUser);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Remove authorization header
    delete api.defaults.headers.common['Authorization'];
    
    // Clear user data
    setUser(null);
    setError(null);

    // Optionally call logout endpoint
    api.post('/auth/logout').catch(() => {
      // Ignore errors on logout
    });
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    error,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};