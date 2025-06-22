import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, TestTube, Settings } from 'lucide-react';
import { Application } from '../../types';
import './ApplicationModal.css';

interface ApplicationModalProps {
  application: Application | null;
  onSave: (data: Partial<Application>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface FormData {
  name: string;
  displayName: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  category: string;
  ownerTeam: string;
  ownerEmail: string;
  healthUrl: string;
  healthMethod: 'GET' | 'POST';
  healthTimeout: number;
  healthExpectedStatus: string;
  healthInterval: number;
  healthRetryAttempts: number;
  healthEnabled: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPasswordEnv: string;
  loginTimeout: number;
  loginScreenshotOnFailure: boolean;
  loginEnabled: boolean;
  notificationsTeams: boolean;
  notificationsEmail: boolean;
  notificationsThreshold: 'error' | 'warning' | 'info';
  slaUptimeTarget: number;
  slaResponseTime: number;
}

const initialFormData: FormData = {
  name: '',
  displayName: '',
  description: '',
  environment: 'production',
  category: 'API Service',
  ownerTeam: '',
  ownerEmail: '',
  healthUrl: '',
  healthMethod: 'GET',
  healthTimeout: 5000,
  healthExpectedStatus: '200,204',
  healthInterval: 300,
  healthRetryAttempts: 3,
  healthEnabled: true,
  loginUrl: '',
  loginUsername: 'healthcheck@company.com',
  loginPasswordEnv: 'HEALTH_CHECK_PASSWORD',
  loginTimeout: 30000,
  loginScreenshotOnFailure: true,
  loginEnabled: false,
  notificationsTeams: false,
  notificationsEmail: true,
  notificationsThreshold: 'error',
  slaUptimeTarget: 99.5,
  slaResponseTime: 2000,
};

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  application,
  onSave,
  onDelete,
  onClose,
}) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [activeTab, setActiveTab] = useState<'basic' | 'health' | 'login' | 'notifications'>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name || '',
        displayName: application.displayName || '',
        description: application.description || '',
        environment: application.environment || 'production',
        category: application.category || 'API Service',
        ownerTeam: application.owner?.team || '',
        ownerEmail: application.owner?.email || '',
        healthUrl: application.healthUrl || '',
        healthMethod: application.config?.healthCheck?.method || 'GET',
        healthTimeout: application.config?.healthCheck?.timeout || 5000,
        healthExpectedStatus: application.config?.healthCheck?.expectedStatus?.join(',') || '200,204',
        healthInterval: application.config?.healthCheck?.interval || 300,
        healthRetryAttempts: application.config?.healthCheck?.retryAttempts || 3,
        healthEnabled: application.config?.healthCheck?.enabled !== false,
        loginUrl: application.loginUrl || '',
        loginUsername: application.config?.loginTest?.credentials?.username || 'healthcheck@company.com',
        loginPasswordEnv: application.config?.loginTest?.credentials?.passwordEnvVar || 'HEALTH_CHECK_PASSWORD',
        loginTimeout: application.config?.loginTest?.timeout || 30000,
        loginScreenshotOnFailure: application.config?.loginTest?.screenshotOnFailure !== false,
        loginEnabled: application.config?.loginTest?.enabled || false,
        notificationsTeams: application.config?.notifications?.teams?.enabled || false,
        notificationsEmail: application.config?.notifications?.email?.enabled !== false,
        notificationsThreshold: application.config?.notifications?.threshold || 'error',
        slaUptimeTarget: application.slaTarget || 99.5,
        slaResponseTime: application.config?.sla?.responseTime || 2000,
      });
    }
  }, [application]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.displayName.trim()) newErrors.displayName = 'Display name is required';
    if (!formData.ownerEmail.trim()) newErrors.ownerEmail = 'Owner email is required';
    if (!formData.healthUrl.trim()) newErrors.healthUrl = 'Health URL is required';

    if (formData.loginEnabled && !formData.loginUrl.trim()) {
      newErrors.loginUrl = 'Login URL is required when login test is enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const appData: Partial<Application> = {
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description,
      environment: formData.environment,
      category: formData.category,
      healthUrl: formData.healthUrl,
      loginUrl: formData.loginUrl,
      owner: {
        team: formData.ownerTeam,
        email: formData.ownerEmail,
      },
      slaTarget: formData.slaUptimeTarget,
      config: {
        healthCheck: {
          method: formData.healthMethod,
          timeout: formData.healthTimeout,
          expectedStatus: formData.healthExpectedStatus.split(',').map(s => parseInt(s.trim())),
          interval: formData.healthInterval,
          retryAttempts: formData.healthRetryAttempts,
          enabled: formData.healthEnabled,
        },
        loginTest: {
          enabled: formData.loginEnabled,
          credentials: {
            username: formData.loginUsername,
            passwordEnvVar: formData.loginPasswordEnv,
          },
          timeout: formData.loginTimeout,
          screenshotOnFailure: formData.loginScreenshotOnFailure,
        },
        notifications: {
          teams: {
            enabled: formData.notificationsTeams,
          },
          email: {
            enabled: formData.notificationsEmail,
          },
          threshold: formData.notificationsThreshold,
        },
        sla: {
          responseTime: formData.slaResponseTime,
        },
      },
    };

    onSave(appData);
  };

  const handleTestConfig = () => {
    // This would trigger a test of the current configuration
    console.log('Testing configuration...');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {application ? `Configure Application: ${application.name}` : 'Add New Application'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button
            className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
          >
            Health Check
          </button>
          <button
            className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Login Test
          </button>
          <button
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications & SLA
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'basic' && (
            <div className="form-section">
              <div className="form-group">
                <label>Application Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  placeholder="e.g., user-service"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={e => handleInputChange('displayName', e.target.value)}
                  placeholder="e.g., User Service"
                  className={errors.displayName ? 'error' : ''}
                />
                {errors.displayName && <span className="error-text">{errors.displayName}</span>}
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of the application"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Environment *</label>
                  <select
                    value={formData.environment}
                    onChange={e => handleInputChange('environment', e.target.value)}
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={e => handleInputChange('category', e.target.value)}
                  >
                    <option value="API Service">API Service</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Database">Database</option>
                    <option value="Microservice">Microservice</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Owner Team</label>
                  <input
                    type="text"
                    value={formData.ownerTeam}
                    onChange={e => handleInputChange('ownerTeam', e.target.value)}
                    placeholder="e.g., Platform Team"
                  />
                </div>

                <div className="form-group">
                  <label>Owner Email *</label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={e => handleInputChange('ownerEmail', e.target.value)}
                    placeholder="team@company.com"
                    className={errors.ownerEmail ? 'error' : ''}
                  />
                  {errors.ownerEmail && <span className="error-text">{errors.ownerEmail}</span>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="form-section">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.healthEnabled}
                    onChange={e => handleInputChange('healthEnabled', e.target.checked)}
                  />
                  Enable Health Check
                </label>
              </div>

              <div className="form-group">
                <label>Health Check URL *</label>
                <input
                  type="url"
                  value={formData.healthUrl}
                  onChange={e => handleInputChange('healthUrl', e.target.value)}
                  placeholder="https://your-app.com/health"
                  className={errors.healthUrl ? 'error' : ''}
                />
                {errors.healthUrl && <span className="error-text">{errors.healthUrl}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Method</label>
                  <select
                    value={formData.healthMethod}
                    onChange={e => handleInputChange('healthMethod', e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Timeout (ms)</label>
                  <input
                    type="number"
                    value={formData.healthTimeout}
                    onChange={e => handleInputChange('healthTimeout', parseInt(e.target.value))}
                    min="1000"
                    max="30000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Expected Status Codes</label>
                <input
                  type="text"
                  value={formData.healthExpectedStatus}
                  onChange={e => handleInputChange('healthExpectedStatus', e.target.value)}
                  placeholder="200, 204"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Interval (seconds)</label>
                  <input
                    type="number"
                    value={formData.healthInterval}
                    onChange={e => handleInputChange('healthInterval', parseInt(e.target.value))}
                    min="60"
                    max="3600"
                  />
                </div>

                <div className="form-group">
                  <label>Retry Attempts</label>
                  <input
                    type="number"
                    value={formData.healthRetryAttempts}
                    onChange={e => handleInputChange('healthRetryAttempts', parseInt(e.target.value))}
                    min="1"
                    max="5"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'login' && (
            <div className="form-section">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.loginEnabled}
                    onChange={e => handleInputChange('loginEnabled', e.target.checked)}
                  />
                  Enable Login Test
                </label>
              </div>

              <div className="form-group">
                <label>Login URL</label>
                <input
                  type="url"
                  value={formData.loginUrl}
                  onChange={e => handleInputChange('loginUrl', e.target.value)}
                  placeholder="https://your-app.com/login"
                  className={errors.loginUrl ? 'error' : ''}
                />
                {errors.loginUrl && <span className="error-text">{errors.loginUrl}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={formData.loginUsername}
                    onChange={e => handleInputChange('loginUsername', e.target.value)}
                    placeholder="healthcheck@company.com"
                  />
                </div>

                <div className="form-group">
                  <label>Password Environment Variable</label>
                  <input
                    type="text"
                    value={formData.loginPasswordEnv}
                    onChange={e => handleInputChange('loginPasswordEnv', e.target.value)}
                    placeholder="HEALTH_CHECK_PASSWORD"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  value={formData.loginTimeout}
                  onChange={e => handleInputChange('loginTimeout', parseInt(e.target.value))}
                  min="5000"
                  max="60000"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.loginScreenshotOnFailure}
                    onChange={e => handleInputChange('loginScreenshotOnFailure', e.target.checked)}
                  />
                  Screenshot on Failure
                </label>
              </div>

              <div className="form-group">
                <button className="config-btn" onClick={handleTestConfig}>
                  <Settings size={16} />
                  Configure Test Steps
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="form-section">
              <div className="form-group">
                <label>Notification Methods</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notificationsTeams}
                      onChange={e => handleInputChange('notificationsTeams', e.target.checked)}
                    />
                    Teams
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notificationsEmail}
                      onChange={e => handleInputChange('notificationsEmail', e.target.checked)}
                    />
                    Email
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Notification Threshold</label>
                <select
                  value={formData.notificationsThreshold}
                  onChange={e => handleInputChange('notificationsThreshold', e.target.value)}
                >
                  <option value="error">Error Only</option>
                  <option value="warning">Warning & Error</option>
                  <option value="info">All Events</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Uptime Target (%)</label>
                  <input
                    type="number"
                    value={formData.slaUptimeTarget}
                    onChange={e => handleInputChange('slaUptimeTarget', parseFloat(e.target.value))}
                    min="90"
                    max="100"
                    step="0.1"
                  />
                </div>

                <div className="form-group">
                  <label>Response Time SLA (ms)</label>
                  <input
                    type="number"
                    value={formData.slaResponseTime}
                    onChange={e => handleInputChange('slaResponseTime', parseInt(e.target.value))}
                    min="100"
                    max="10000"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {onDelete && (
              <button className="btn danger" onClick={onDelete}>
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>

          <div className="footer-right">
            <button className="btn secondary" onClick={handleTestConfig}>
              <TestTube size={16} />
              Test Config
            </button>
            <button className="btn primary" onClick={handleSave}>
              <Save size={16} />
              Save
            </button>
            <button className="btn secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};