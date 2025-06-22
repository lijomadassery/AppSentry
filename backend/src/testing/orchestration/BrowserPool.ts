import { Browser, BrowserContext, chromium, firefox, webkit } from 'playwright';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { config } from '../../config/env';
import { BrowserPoolConfig } from '../../types/testing';

interface PooledBrowser {
  id: string;
  browser: Browser;
  contexts: Map<string, BrowserContext>;
  isHealthy: boolean;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export class BrowserPool extends EventEmitter {
  private readonly config: BrowserPoolConfig;
  private readonly browsers: Map<string, PooledBrowser> = new Map();
  private readonly availableBrowsers: string[] = [];
  private readonly busyBrowsers: Set<string> = new Set();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(poolConfig?: Partial<BrowserPoolConfig>) {
    super();
    
    this.config = {
      maxConcurrency: poolConfig?.maxConcurrency || config.testing.parallelTestLimit,
      browserType: poolConfig?.browserType || 'chromium',
      headless: poolConfig?.headless ?? config.testing.playwrightHeadless,
      launchOptions: {
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
        ...poolConfig?.launchOptions,
      },
    };

    this.startHealthCheck();
  }

  public async initialize(): Promise<void> {
    logger.info(`Initializing browser pool with ${this.config.maxConcurrency} browsers`);

    try {
      // Pre-warm the pool with initial browsers
      const initialBrowserCount = Math.min(2, this.config.maxConcurrency);
      
      for (let i = 0; i < initialBrowserCount; i++) {
        await this.createBrowser();
      }

      logger.info(`Browser pool initialized with ${this.browsers.size} browsers`);
    } catch (error) {
      logger.error(`Failed to initialize browser pool: ${error}`);
      throw error;
    }
  }

  public async acquireBrowser(): Promise<{ browserId: string; browser: Browser }> {
    // Try to get an available browser
    let browserId = this.availableBrowsers.pop();

    // If no available browsers, create a new one if under limit
    if (!browserId && this.browsers.size < this.config.maxConcurrency) {
      browserId = await this.createBrowser();
    }

    // If still no browser available, wait for one to become available
    if (!browserId) {
      browserId = await this.waitForAvailableBrowser();
    }

    const pooledBrowser = this.browsers.get(browserId);
    if (!pooledBrowser) {
      throw new Error(`Browser ${browserId} not found in pool`);
    }

    // Mark as busy
    this.busyBrowsers.add(browserId);
    pooledBrowser.lastUsed = new Date();
    pooledBrowser.usageCount++;

    logger.debug(`Browser ${browserId} acquired (${this.busyBrowsers.size}/${this.browsers.size} busy)`);

    return {
      browserId,
      browser: pooledBrowser.browser,
    };
  }

  public async releaseBrowser(browserId: string): Promise<void> {
    const pooledBrowser = this.browsers.get(browserId);
    if (!pooledBrowser) {
      logger.warn(`Attempted to release unknown browser: ${browserId}`);
      return;
    }

    // Close all contexts for this browser
    for (const [contextId, context] of pooledBrowser.contexts) {
      try {
        await context.close();
        pooledBrowser.contexts.delete(contextId);
      } catch (error) {
        logger.warn(`Failed to close browser context ${contextId}: ${error}`);
      }
    }

    // Mark as available
    this.busyBrowsers.delete(browserId);
    this.availableBrowsers.push(browserId);

    logger.debug(`Browser ${browserId} released (${this.busyBrowsers.size}/${this.browsers.size} busy)`);

    // Emit availability event
    this.emit('browserAvailable', browserId);
  }

  public async createContext(
    browserId: string,
    contextOptions?: any,
  ): Promise<{ contextId: string; context: BrowserContext }> {
    const pooledBrowser = this.browsers.get(browserId);
    if (!pooledBrowser) {
      throw new Error(`Browser ${browserId} not found in pool`);
    }

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultOptions = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'AppSentry-TestRunner/1.0',
      ignoreHTTPSErrors: true,
      ...contextOptions,
    };

    try {
      const context = await pooledBrowser.browser.newContext(defaultOptions);
      pooledBrowser.contexts.set(contextId, context);

      logger.debug(`Created browser context ${contextId} for browser ${browserId}`);

      return { contextId, context };
    } catch (error) {
      logger.error(`Failed to create browser context: ${error}`);
      throw error;
    }
  }

  public async closeContext(browserId: string, contextId: string): Promise<void> {
    const pooledBrowser = this.browsers.get(browserId);
    if (!pooledBrowser) {
      logger.warn(`Browser ${browserId} not found when closing context ${contextId}`);
      return;
    }

    const context = pooledBrowser.contexts.get(contextId);
    if (!context) {
      logger.warn(`Context ${contextId} not found in browser ${browserId}`);
      return;
    }

    try {
      await context.close();
      pooledBrowser.contexts.delete(contextId);
      logger.debug(`Closed browser context ${contextId} for browser ${browserId}`);
    } catch (error) {
      logger.warn(`Failed to close browser context ${contextId}: ${error}`);
    }
  }

  public async getPoolStats(): Promise<{
    total: number;
    available: number;
    busy: number;
    healthy: number;
    contexts: number;
  }> {
    let totalContexts = 0;
    let healthyBrowsers = 0;

    for (const pooledBrowser of this.browsers.values()) {
      totalContexts += pooledBrowser.contexts.size;
      if (pooledBrowser.isHealthy) {
        healthyBrowsers++;
      }
    }

    return {
      total: this.browsers.size,
      available: this.availableBrowsers.length,
      busy: this.busyBrowsers.size,
      healthy: healthyBrowsers,
      contexts: totalContexts,
    };
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down browser pool');

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close all browsers
    const closePromises: Promise<void>[] = [];

    for (const [browserId, pooledBrowser] of this.browsers) {
      closePromises.push(this.closeBrowser(browserId, pooledBrowser));
    }

    await Promise.allSettled(closePromises);

    this.browsers.clear();
    this.availableBrowsers.length = 0;
    this.busyBrowsers.clear();

    logger.info('Browser pool shutdown complete');
  }

  private async createBrowser(): Promise<string> {
    const browserId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      let browser: Browser;

      switch (this.config.browserType) {
        case 'firefox':
          browser = await firefox.launch({
            headless: this.config.headless,
            ...this.config.launchOptions,
          });
          break;
        case 'webkit':
          browser = await webkit.launch({
            headless: this.config.headless,
            ...this.config.launchOptions,
          });
          break;
        default:
          browser = await chromium.launch({
            headless: this.config.headless,
            ...this.config.launchOptions,
          });
      }

      const pooledBrowser: PooledBrowser = {
        id: browserId,
        browser,
        contexts: new Map(),
        isHealthy: true,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0,
      };

      this.browsers.set(browserId, pooledBrowser);
      this.availableBrowsers.push(browserId);

      logger.debug(`Created new browser ${browserId} (${this.browsers.size}/${this.config.maxConcurrency})`);

      return browserId;
    } catch (error) {
      logger.error(`Failed to create browser: ${error}`);
      throw error;
    }
  }

  private async waitForAvailableBrowser(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available browser'));
      }, 30000); // 30 second timeout

      const onBrowserAvailable = (browserId: string) => {
        clearTimeout(timeout);
        this.removeListener('browserAvailable', onBrowserAvailable);
        resolve(browserId);
      };

      this.on('browserAvailable', onBrowserAvailable);
    });
  }

  private async closeBrowser(browserId: string, pooledBrowser: PooledBrowser): Promise<void> {
    try {
      // Close all contexts first
      for (const [contextId, context] of pooledBrowser.contexts) {
        try {
          await context.close();
        } catch (error) {
          logger.warn(`Failed to close context ${contextId}: ${error}`);
        }
      }

      // Close the browser
      await pooledBrowser.browser.close();
      logger.debug(`Closed browser ${browserId}`);
    } catch (error) {
      logger.error(`Failed to close browser ${browserId}: ${error}`);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const maxIdleTime = 30 * 60 * 1000; // 30 minutes
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    for (const [browserId, pooledBrowser] of this.browsers) {
      try {
        // Check if browser is too old or idle
        const isOld = now.getTime() - pooledBrowser.createdAt.getTime() > maxAge;
        const isIdle = now.getTime() - pooledBrowser.lastUsed.getTime() > maxIdleTime;
        const isNotBusy = !this.busyBrowsers.has(browserId);

        if ((isOld || isIdle) && isNotBusy && this.browsers.size > 1) {
          logger.debug(`Removing idle browser ${browserId}`);
          await this.closeBrowser(browserId, pooledBrowser);
          this.browsers.delete(browserId);
          
          // Remove from available list
          const index = this.availableBrowsers.indexOf(browserId);
          if (index > -1) {
            this.availableBrowsers.splice(index, 1);
          }
          continue;
        }

        // Check if browser is still responsive
        try {
          const context = await pooledBrowser.browser.newContext();
          await context.close();
          pooledBrowser.isHealthy = true;
        } catch (error) {
          logger.warn(`Browser ${browserId} failed health check: ${error}`);
          pooledBrowser.isHealthy = false;
          
          // If browser is unhealthy and not busy, replace it
          if (isNotBusy) {
            logger.info(`Replacing unhealthy browser ${browserId}`);
            await this.closeBrowser(browserId, pooledBrowser);
            this.browsers.delete(browserId);
            
            const index = this.availableBrowsers.indexOf(browserId);
            if (index > -1) {
              this.availableBrowsers.splice(index, 1);
            }
            
            // Create replacement browser
            await this.createBrowser();
          }
        }
      } catch (error) {
        logger.error(`Error during health check for browser ${browserId}: ${error}`);
      }
    }
  }
}

export default BrowserPool;