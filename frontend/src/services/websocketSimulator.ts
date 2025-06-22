import { TestProgress, ActivityLog, Application } from '../types';

export class WebSocketSimulator {
  private eventListeners: Map<string, Function[]> = new Map();
  private currentTestRun: string | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;

  public on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  public simulateTestRun(applications: Application[]): string {
    const testRunId = `sim_${Date.now()}`;
    this.currentTestRun = testRunId;

    // Emit test run started
    this.emit('testRunStarted', {
      testRunId,
      applicationCount: applications.length,
    });

    let completedTests = 0;
    const totalTests = applications.length * 2; // Health check + login test
    let currentAppIndex = 0;

    // Simulate progress updates
    this.simulationInterval = setInterval(() => {
      if (completedTests >= totalTests) {
        // Test run completed
        this.emit('testRunCompleted', {
          testRunId,
          status: 'completed',
          completed: completedTests,
          total: totalTests,
        });

        if (this.simulationInterval) {
          clearInterval(this.simulationInterval);
          this.simulationInterval = null;
        }
        this.currentTestRun = null;
        return;
      }

      const currentApp = applications[currentAppIndex];
      const isHealthCheck = completedTests % 2 === 0;
      const testType = isHealthCheck ? 'health_check' : 'login_test';

      // Emit test started
      this.emit('testStarted', {
        testRunId,
        applicationId: currentApp.id,
        applicationName: currentApp.displayName || currentApp.name,
        testType,
      });

      // Simulate test completion after a short delay
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success rate
        
        if (success) {
          this.emit('testCompleted', {
            testRunId,
            applicationId: currentApp.id,
            applicationName: currentApp.displayName || currentApp.name,
            testType,
            status: 'passed',
            duration: Math.floor(Math.random() * 3000) + 1000, // 1-4 seconds
          });
        } else {
          this.emit('testFailed', {
            testRunId,
            applicationId: currentApp.id,
            applicationName: currentApp.displayName || currentApp.name,
            testType,
            error: isHealthCheck ? 'Connection timeout' : 'Login failed - invalid credentials',
          });
        }

        completedTests++;

        // Update progress
        this.emit('progressUpdate', {
          testRunId,
          currentApplication: currentApp.displayName || currentApp.name,
          completed: completedTests,
          total: totalTests,
          status: 'running',
        });

        // Move to next application after login test
        if (!isHealthCheck) {
          currentAppIndex++;
        }
      }, 500);

    }, 2000); // Every 2 seconds

    return testRunId;
  }

  public simulateApplicationStatusUpdate(application: Application) {
    const statuses: Array<'healthy' | 'warning' | 'error'> = ['healthy', 'warning', 'error'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const responseTime = randomStatus === 'healthy' 
      ? Math.floor(Math.random() * 500) + 100  // 100-600ms
      : randomStatus === 'warning'
      ? Math.floor(Math.random() * 1000) + 1000 // 1-2s
      : Math.floor(Math.random() * 5000) + 5000; // 5-10s or timeout

    const updatedApp: Application = {
      ...application,
      status: randomStatus,
      responseTime,
      lastChecked: new Date(),
      uptime: randomStatus === 'healthy' ? 99.9 : randomStatus === 'warning' ? 99.1 : 98.5,
    };

    this.emit('applicationStatusUpdate', updatedApp);
  }

  public simulateRandomActivity() {
    const activities = [
      { status: 'success', message: 'Automated health check passed', app: 'user-service' },
      { status: 'warning', message: 'Response time elevated', app: 'payment-api' },
      { status: 'error', message: 'Database connection failed', app: 'auth-service' },
      { status: 'success', message: 'Login test completed', app: 'user-dashboard' },
      { status: 'warning', message: 'SSL certificate expires soon', app: 'notification-svc' },
    ];

    const activity = activities[Math.floor(Math.random() * activities.length)];

    this.emit('healthMetricUpdate', {
      applicationId: activity.app,
      applicationName: activity.app.charAt(0).toUpperCase() + activity.app.slice(1),
      status: activity.status === 'success' ? 'healthy' : 'warning',
      responseTime: Math.floor(Math.random() * 2000) + 200,
      message: activity.message,
    });
  }

  public simulateNotification(type: 'info' | 'warning' | 'error', message: string) {
    this.emit('notification', {
      type,
      message,
      timestamp: new Date(),
    });
  }

  public stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.currentTestRun) {
      this.emit('testRunCancelled', {
        testRunId: this.currentTestRun,
      });
      this.currentTestRun = null;
    }
  }

  public isRunning(): boolean {
    return this.currentTestRun !== null;
  }
}

export const webSocketSimulator = new WebSocketSimulator();