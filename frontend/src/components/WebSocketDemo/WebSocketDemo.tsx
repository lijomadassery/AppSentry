import React, { useEffect, useState } from 'react';
import { Play, Square, Zap, Activity } from 'lucide-react';
import './WebSocketDemo.css';

interface WebSocketDemoProps {
  onSimulateTest: () => void;
  onSimulateStatusUpdate: () => void;
  onSimulateActivity: () => void;
  isTestRunning: boolean;
}

export const WebSocketDemo: React.FC<WebSocketDemoProps> = ({
  onSimulateTest,
  onSimulateStatusUpdate,
  onSimulateActivity,
  isTestRunning,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Show demo panel only in development
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development');
  }, []);

  if (!isVisible) return null;

  return (
    <div className="websocket-demo">
      <div className="demo-header">
        <Zap size={16} />
        <h4>WebSocket Demo</h4>
      </div>
      
      <div className="demo-controls">
        <button
          className="demo-btn primary"
          onClick={onSimulateTest}
          disabled={isTestRunning}
        >
          <Play size={14} />
          {isTestRunning ? 'Test Running...' : 'Simulate Test Run'}
        </button>
        
        <button
          className="demo-btn secondary"
          onClick={onSimulateStatusUpdate}
        >
          <Activity size={14} />
          Status Update
        </button>
        
        <button
          className="demo-btn secondary"
          onClick={onSimulateActivity}
        >
          <Square size={14} />
          Add Activity
        </button>
      </div>
      
      <div className="demo-info">
        <p>Development mode - simulate real-time events</p>
      </div>
    </div>
  );
};