import React from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppProvider>
          <div className="App">
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </div>
        </AppProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;