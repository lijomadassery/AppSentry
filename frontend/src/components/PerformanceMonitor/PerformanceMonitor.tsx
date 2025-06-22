import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';

export const PerformanceMonitor: React.FC = () => {
  const { state } = useApp();
  const renderCount = useRef(0);
  const [apiCalls, setApiCalls] = useState(0);
  
  // Count renders
  renderCount.current += 1;
  
  // Track API loading states to estimate API calls
  useEffect(() => {
    if (state.applicationsLoading || state.statsLoading) {
      setApiCalls(prev => prev + 1);
    }
  }, [state.applicationsLoading, state.statsLoading]);
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 10000,
      pointerEvents: 'none'
    }}>
      <div>Renders: {renderCount.current}</div>
      <div>API Calls: {apiCalls}</div>
      <div>Apps: {state.applications.length}</div>
    </div>
  );
};