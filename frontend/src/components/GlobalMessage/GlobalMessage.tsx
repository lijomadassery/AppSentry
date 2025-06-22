import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './GlobalMessage.css';

export const GlobalMessage: React.FC = () => {
  const { state, clearMessage } = useApp();
  const { globalMessage } = state;

  useEffect(() => {
    if (globalMessage) {
      const timer = setTimeout(() => {
        clearMessage();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [globalMessage, clearMessage]);

  if (!globalMessage) return null;

  const getIcon = () => {
    switch (globalMessage.type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'info':
        return <Info size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  return (
    <div className={`global-message ${globalMessage.type}`}>
      <div className="message-content">
        {getIcon()}
        <span>{globalMessage.message}</span>
      </div>
      <button className="close-btn" onClick={clearMessage}>
        <X size={16} />
      </button>
    </div>
  );
};