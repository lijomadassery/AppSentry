import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class AuthService {
  private msalInstance: ConfidentialClientApplication;

  constructor() {
    const msalConfig = {
      auth: {
        clientId: config.azureAd.clientId,
        clientSecret: config.azureAd.clientSecret,
        authority: `https://login.microsoftonline.com/${config.azureAd.tenantId}`,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: any, message: string) => {
            logger.debug(`MSAL ${level}: ${message}`);
          },
          piiLoggingEnabled: false,
          logLevel: config.env === 'development' ? 3 : 1,
        },
      },
    };

    this.msalInstance = new ConfidentialClientApplication(msalConfig);
  }

  public getAuthCodeUrl(): Promise<string> {
    const authCodeUrlParameters = {
      scopes: ['user.read', 'profile', 'openid', 'email'],
      redirectUri: config.azureAd.redirectUri,
    };

    return this.msalInstance.getAuthCodeUrl(authCodeUrlParameters);
  }

  public async acquireTokenByCode(code: string): Promise<AuthenticationResult | null> {
    const tokenRequest = {
      code,
      scopes: ['user.read', 'profile', 'openid', 'email'],
      redirectUri: config.azureAd.redirectUri,
    };

    try {
      const response = await this.msalInstance.acquireTokenByCode(tokenRequest);
      return response;
    } catch (error) {
      logger.error('Error acquiring token by code:', error);
      return null;
    }
  }

  public async acquireTokenSilent(
    account: any,
    scopes: string[] = ['user.read'],
  ): Promise<AuthenticationResult | null> {
    const silentRequest = {
      account,
      scopes,
    };

    try {
      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      return response;
    } catch (error) {
      logger.error('Error acquiring token silently:', error);
      return null;
    }
  }

  public async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching user info:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();