import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TestProgress, ActivityLog, Application } from '../types';

interface UseWebSocketReturn {
  connected: boolean;
  connecting: boolean;
  testProgress: TestProgress | null;
  activities: ActivityLog[];
  subscribeToTestRun: (testRunId: string) => void;
  unsubscribeFromTestRun: (testRunId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
  onApplicationUpdate: (callback: (app: Application) => void) => void;
  onTestRunCompleted: (callback: (testRunId: string) => void) => void;
  onNotification: (callback: (notification: any) => void) => void;
}

export const useWebSocket = (url: string): UseWebSocketReturn => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const applicationUpdateCallbackRef = useRef<((app: Application) => void) | null>(null);
  const testRunCompletedCallbackRef = useRef<((testRunId: string) => void) | null>(null);
  const notificationCallbackRef = useRef<((notification: any) => void) | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setConnecting(true);
    
    socketRef.current = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected to AppSentry backend');
      setConnected(true);
      setConnecting(false);
      reconnectAttempts.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      setConnecting(false);
      
      // Clear test progress on disconnect
      setTestProgress(null);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnecting(false);
      reconnectAttempts.current++;
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setConnected(true);
      setConnecting(false);
    });

    socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed after', maxReconnectAttempts, 'attempts');
      setConnecting(false);
    });

    // Test progress events
    socket.on('progressUpdate', (progress: TestProgress) => {
      console.log('Test progress update:', progress);
      setTestProgress(progress);
    });

    socket.on('testRunStarted', (data: any) => {
      console.log('Test run started:', data);
      const activity: ActivityLog = {
        id: `start_${data.testRunId}_${Date.now()}`,
        applicationId: 'system',
        applicationName: 'System',
        status: 'warning',
        message: `Test run started for ${data.applicationCount} applications`,
        timestamp: new Date(),
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

    socket.on('testStarted', (data: any) => {
      console.log('Individual test started:', data);
      const activity: ActivityLog = {
        id: `test_start_${data.testRunId}_${data.applicationId}_${Date.now()}`,
        applicationId: data.applicationId,
        applicationName: data.applicationName || data.applicationId,
        status: 'warning',
        message: `${data.testType === 'health_check' ? 'Health check' : 'Login test'} started`,
        timestamp: new Date(),
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

    socket.on('testCompleted', (result: any) => {
      console.log('Test completed:', result);
      const activity: ActivityLog = {
        id: `complete_${result.testRunId}_${result.applicationId}_${Date.now()}`,
        applicationId: result.applicationId,
        applicationName: result.applicationName || result.applicationId,
        status: result.status === 'passed' ? 'success' : 'error',
        message: result.status === 'passed' 
          ? `${result.testType === 'health_check' ? 'Health check' : 'Login test'} passed`
          : result.error || 'Test failed',
        timestamp: new Date(),
        duration: result.duration,
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

    socket.on('testFailed', (result: any) => {
      console.log('Test failed:', result);
      const activity: ActivityLog = {
        id: `failed_${result.testRunId}_${result.applicationId}_${Date.now()}`,
        applicationId: result.applicationId,
        applicationName: result.applicationName || result.applicationId,
        status: 'error',
        message: result.error || 'Test failed',
        timestamp: new Date(),
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

    socket.on('testRunCompleted', (data: any) => {
      console.log('Test run completed:', data);
      setTestProgress(null);
      
      const activity: ActivityLog = {
        id: `run_complete_${data.testRunId}_${Date.now()}`,
        applicationId: 'system',
        applicationName: 'System',
        status: data.status === 'completed' ? 'success' : 'error',
        message: `Test run ${data.status} - ${data.completed || 0} tests completed`,
        timestamp: new Date(),
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);

      // Notify callback if registered
      if (testRunCompletedCallbackRef.current) {
        testRunCompletedCallbackRef.current(data.testRunId);
      }
    });

    socket.on('testRunCancelled', (data: any) => {
      console.log('Test run cancelled:', data);
      setTestProgress(null);
      
      const activity: ActivityLog = {
        id: `cancelled_${data.testRunId}_${Date.now()}`,
        applicationId: 'system',
        applicationName: 'System',
        status: 'warning',
        message: 'Test run cancelled by user',
        timestamp: new Date(),
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

    // Application status updates
    socket.on('applicationStatusUpdate', (app: Application) => {
      console.log('Application status updated:', app);
      const activity: ActivityLog = {
        id: `status_${app.id}_${Date.now()}`,
        applicationId: app.id,
        applicationName: app.displayName || app.name,
        status: app.status === 'healthy' ? 'success' : app.status === 'warning' ? 'warning' : 'error',
        message: `Status: ${app.status} (${app.responseTime}ms)`,
        timestamp: new Date(),
        duration: app.responseTime,
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);

      // Notify callback if registered
      if (applicationUpdateCallbackRef.current) {
        applicationUpdateCallbackRef.current(app);
      }
    });

    // Notification events
    socket.on('notification', (notification: any) => {
      console.log('Notification received:', notification);
      if (notificationCallbackRef.current) {
        notificationCallbackRef.current(notification);
      }
    });

    // Health metric updates
    socket.on('healthMetricUpdate', (data: any) => {
      const activity: ActivityLog = {
        id: `metric_${data.applicationId}_${Date.now()}`,
        applicationId: data.applicationId,
        applicationName: data.applicationName,
        status: data.status === 'healthy' ? 'success' : 'warning',
        message: `Health check: ${data.responseTime}ms`,
        timestamp: new Date(),
        duration: data.responseTime,
      };
      setActivities(prev => [activity, ...prev.slice(0, 19)]);
    });

  }, [url]);

  useEffect(() => {
    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initializeSocket]);

  const subscribeToTestRun = useCallback((testRunId: string) => {
    if (socketRef.current?.connected) {
      console.log('Subscribing to test run:', testRunId);
      socketRef.current.emit('subscribe', { testRunId });
    }
  }, []);

  const unsubscribeFromTestRun = useCallback((testRunId: string) => {
    if (socketRef.current?.connected) {
      console.log('Unsubscribing from test run:', testRunId);
      socketRef.current.emit('unsubscribe', { testRunId });
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setTimeout(() => {
      initializeSocket();
    }, 1000);
  }, [initializeSocket]);

  const onApplicationUpdate = useCallback((callback: (app: Application) => void) => {
    applicationUpdateCallbackRef.current = callback;
  }, []);

  const onTestRunCompleted = useCallback((callback: (testRunId: string) => void) => {
    testRunCompletedCallbackRef.current = callback;
  }, []);

  const onNotification = useCallback((callback: (notification: any) => void) => {
    notificationCallbackRef.current = callback;
  }, []);

  return {
    connected,
    connecting,
    testProgress,
    activities,
    subscribeToTestRun,
    unsubscribeFromTestRun,
    disconnect,
    reconnect,
    onApplicationUpdate,
    onTestRunCompleted,
    onNotification,
  };
};