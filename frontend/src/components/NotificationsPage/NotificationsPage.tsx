import React, { useState, useMemo } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Check,
  Trash2,
  Settings,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
} from 'lucide-react';
import './NotificationsPage.css';

interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  applicationId?: string;
  applicationName?: string;
  actionRequired?: boolean;
  source: 'system' | 'test' | 'user' | 'application';
}

interface NotificationPreferences {
  email: boolean;
  browser: boolean;
  mobile: boolean;
  sound: boolean;
  types: {
    alerts: boolean;
    testResults: boolean;
    systemUpdates: boolean;
    teamActivity: boolean;
  };
}

interface NotificationsPageProps {
  notifications: Notification[];
  preferences: NotificationPreferences;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onUpdatePreferences: (preferences: NotificationPreferences) => void;
}

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'alert',
    title: 'Application Down',
    message: 'Main Portal is not responding. Last successful test was 15 minutes ago.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false,
    applicationId: 'app1',
    applicationName: 'Main Portal',
    actionRequired: true,
    source: 'application',
  },
  {
    id: '2',
    type: 'warning',
    title: 'High Response Time',
    message: 'Customer API response time has increased to 1.2s (threshold: 500ms).',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
    applicationId: 'app3',
    applicationName: 'Customer API',
    actionRequired: false,
    source: 'test',
  },
  {
    id: '3',
    type: 'success',
    title: 'Test Run Completed',
    message: 'All 25 applications passed their health checks successfully.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: true,
    actionRequired: false,
    source: 'test',
  },
  {
    id: '4',
    type: 'info',
    title: 'New Team Member',
    message: 'Sarah Wilson has joined the team as an Editor.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read: true,
    actionRequired: false,
    source: 'user',
  },
  {
    id: '5',
    type: 'warning',
    title: 'SLA Threshold Reached',
    message: 'Admin Dashboard uptime dropped to 98.5% (SLA: 99%).',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    read: false,
    applicationId: 'app2',
    applicationName: 'Admin Dashboard',
    actionRequired: true,
    source: 'application',
  },
];

const defaultPreferences: NotificationPreferences = {
  email: true,
  browser: true,
  mobile: false,
  sound: true,
  types: {
    alerts: true,
    testResults: true,
    systemUpdates: true,
    teamActivity: false,
  },
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications = mockNotifications,
  preferences = defaultPreferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onUpdatePreferences,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts' | 'read'>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [localPreferences, setLocalPreferences] = useState(preferences);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      switch (filter) {
        case 'unread':
          return !notification.read;
        case 'alerts':
          return notification.type === 'alert' || notification.actionRequired;
        case 'read':
          return notification.read;
        default:
          return true;
      }
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notifications, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const alerts = notifications.filter(n => n.type === 'alert' || n.actionRequired).length;
    const today = notifications.filter(n => {
      const today = new Date();
      const notifDate = new Date(n.timestamp);
      return notifDate.toDateString() === today.toDateString();
    }).length;

    return { total, unread, alerts, today };
  }, [notifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <XCircle className="notification-icon alert" size={20} />;
      case 'warning':
        return <AlertCircle className="notification-icon warning" size={20} />;
      case 'success':
        return <CheckCircle className="notification-icon success" size={20} />;
      case 'info':
        return <MessageSquare className="notification-icon info" size={20} />;
      default:
        return <Bell className="notification-icon" size={20} />;
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTypePreferenceChange = (type: keyof NotificationPreferences['types'], value: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: value,
      },
    }));
  };

  const savePreferences = () => {
    onUpdatePreferences(localPreferences);
    setShowPreferences(false);
  };

  return (
    <div className="notifications-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <Bell size={24} />
            Notifications
            {stats.unread > 0 && <span className="unread-badge">{stats.unread}</span>}
          </h1>
          <p>Stay updated with alerts, test results, and system notifications</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn secondary"
            onClick={() => setShowPreferences(!showPreferences)}
          >
            <Settings size={16} />
            Preferences
          </button>
          {stats.unread > 0 && (
            <button className="btn secondary" onClick={onMarkAllAsRead}>
              <Check size={16} />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Notification Stats */}
      <div className="notification-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <Bell size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon unread">
            <Mail size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.unread}</div>
            <div className="stat-label">Unread</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon alerts">
            <AlertCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.alerts}</div>
            <div className="stat-label">Alerts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon today">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: 'All', count: stats.total },
          { key: 'unread', label: 'Unread', count: stats.unread },
          { key: 'alerts', label: 'Alerts', count: stats.alerts },
          { key: 'read', label: 'Read', count: stats.total - stats.unread },
        ].map(tab => (
          <button
            key={tab.key}
            className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => setFilter(tab.key as any)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Notification Preferences Panel */}
      {showPreferences && (
        <div className="preferences-panel">
          <div className="preferences-header">
            <h3>Notification Preferences</h3>
            <p>Configure how and when you receive notifications</p>
          </div>

          <div className="preferences-content">
            <div className="preference-section">
              <h4>Delivery Methods</h4>
              <div className="preference-options">
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.email}
                    onChange={(e) => handlePreferenceChange('email', e.target.checked)}
                  />
                  <Mail size={16} />
                  <span>Email notifications</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.browser}
                    onChange={(e) => handlePreferenceChange('browser', e.target.checked)}
                  />
                  <Monitor size={16} />
                  <span>Browser notifications</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.mobile}
                    onChange={(e) => handlePreferenceChange('mobile', e.target.checked)}
                  />
                  <Smartphone size={16} />
                  <span>Mobile push notifications</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.sound}
                    onChange={(e) => handlePreferenceChange('sound', e.target.checked)}
                  />
                  {localPreferences.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span>Sound alerts</span>
                </label>
              </div>
            </div>

            <div className="preference-section">
              <h4>Notification Types</h4>
              <div className="preference-options">
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.types.alerts}
                    onChange={(e) => handleTypePreferenceChange('alerts', e.target.checked)}
                  />
                  <AlertCircle size={16} />
                  <span>Critical alerts and errors</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.types.testResults}
                    onChange={(e) => handleTypePreferenceChange('testResults', e.target.checked)}
                  />
                  <CheckCircle size={16} />
                  <span>Test results and status changes</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.types.systemUpdates}
                    onChange={(e) => handleTypePreferenceChange('systemUpdates', e.target.checked)}
                  />
                  <Settings size={16} />
                  <span>System updates and maintenance</span>
                </label>
                <label className="preference-item">
                  <input
                    type="checkbox"
                    checked={localPreferences.types.teamActivity}
                    onChange={(e) => handleTypePreferenceChange('teamActivity', e.target.checked)}
                  />
                  <MessageSquare size={16} />
                  <span>Team activity and comments</span>
                </label>
              </div>
            </div>
          </div>

          <div className="preferences-actions">
            <button className="btn secondary" onClick={() => setShowPreferences(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={savePreferences}>
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={48} className="empty-icon" />
            <h3>No notifications</h3>
            <p>
              {filter === 'unread' ? 'All caught up! No unread notifications.' :
               filter === 'alerts' ? 'No alerts at this time.' :
               filter === 'read' ? 'No read notifications.' :
               'No notifications to show.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`notification-item ${notification.read ? 'read' : 'unread'} ${notification.type}`}
            >
              <div className="notification-content">
                <div className="notification-header">
                  <div className="notification-meta">
                    {getNotificationIcon(notification.type)}
                    <span className="notification-title">{notification.title}</span>
                    {notification.actionRequired && (
                      <span className="action-required-badge">Action Required</span>
                    )}
                  </div>
                  <div className="notification-actions">
                    <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
                    {!notification.read && (
                      <button
                        className="action-btn"
                        onClick={() => onMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      className="action-btn"
                      onClick={() => onDeleteNotification(notification.id)}
                      title="Delete notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="notification-body">
                  <p>{notification.message}</p>
                  {notification.applicationName && (
                    <div className="notification-app">
                      <span>Application: {notification.applicationName}</span>
                    </div>
                  )}
                </div>

                {notification.actionRequired && (
                  <div className="notification-footer">
                    <button className="btn primary small">
                      View Details
                    </button>
                    <button className="btn secondary small">
                      Acknowledge
                    </button>
                  </div>
                )}
              </div>
              
              {!notification.read && <div className="unread-indicator" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};