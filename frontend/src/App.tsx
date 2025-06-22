import React from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <div className="App">
          <Dashboard />
        </div>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;