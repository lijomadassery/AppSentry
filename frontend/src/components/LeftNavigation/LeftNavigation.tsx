import React, { useState } from 'react';
import {
  LayoutDashboard,
  Server,
  Activity,
  BarChart3,
  Settings,
  Users,
  Bell,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Menu,
  X,
  GitBranch,
  Gauge,
  FileText,
  Network,
  Search,
  Monitor,
  FolderKanban,
  Cog,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './LeftNavigation.css';

interface NavigationItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
  isActive?: boolean;
  category?: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface LeftNavigationProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeRoute: string;
  onRouteChange: (route: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const LeftNavigation: React.FC<LeftNavigationProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeRoute,
  onRouteChange,
  isDarkMode,
  onToggleDarkMode,
  isMobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { state } = useApp();
  
  // Get real counts from context
  const applicationCount = state.applications.length;
  const notificationCount = (state.stats.errorCount + state.stats.warningCount) || 0;
  
  const navigationSections: NavigationSection[] = [
    {
      title: 'Main',
      items: [
        {
          id: 'dashboard',
          icon: <LayoutDashboard size={20} />,
          label: 'Dashboard',
          path: '/dashboard',
          category: 'main',
        },
      ],
    },
    {
      title: 'Monitor',
      items: [
        {
          id: 'traces',
          icon: <GitBranch size={20} />,
          label: 'Traces',
          path: '/traces',
          category: 'monitor',
        },
        {
          id: 'metrics',
          icon: <Gauge size={20} />,
          label: 'Metrics',
          path: '/metrics',
          category: 'monitor',
        },
        {
          id: 'logs',
          icon: <FileText size={20} />,
          label: 'Logs',
          path: '/logs',
          category: 'monitor',
        },
        {
          id: 'service-map',
          icon: <Network size={20} />,
          label: 'Service Map',
          path: '/service-map',
          category: 'monitor',
        },
        {
          id: 'query-builder',
          icon: <Search size={20} />,
          label: 'Query Builder',
          path: '/query-builder',
          category: 'monitor',
        },
      ],
    },
    {
      title: 'Manage',
      items: [
        {
          id: 'applications',
          icon: <Server size={20} />,
          label: 'Applications',
          path: '/applications',
          badge: applicationCount > 0 ? applicationCount : undefined,
          category: 'manage',
        },
        {
          id: 'test-results',
          icon: <Activity size={20} />,
          label: 'Test Results',
          path: '/test-results',
          category: 'manage',
        },
        {
          id: 'analytics',
          icon: <BarChart3 size={20} />,
          label: 'Analytics',
          path: '/analytics',
          category: 'manage',
        },
      ],
    },
    {
      title: 'Platform',
      items: [
        {
          id: 'team',
          icon: <Users size={20} />,
          label: 'Team',
          path: '/team',
          category: 'platform',
        },
        {
          id: 'notifications',
          icon: <Bell size={20} />,
          label: 'Notifications',
          path: '/notifications',
          badge: notificationCount > 0 ? notificationCount : undefined,
          category: 'platform',
        },
        {
          id: 'settings',
          icon: <Settings size={20} />,
          label: 'Settings',
          path: '/settings',
          category: 'platform',
        },
      ],
    },
  ];

  const handleItemClick = (item: NavigationItem) => {
    onRouteChange(item.id);
    // Close mobile menu after selection
    if (isMobileMenuOpen) {
      onToggleMobileMenu();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay"
          onClick={onToggleMobileMenu}
        />
      )}

      {/* Navigation Sidebar */}
      <div className={`left-navigation ${isCollapsed ? 'collapsed' : 'expanded'} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Navigation Header */}
        <div className="nav-header">
          <div className="nav-logo">
            <div className="logo-icon">
              <Activity size={24} className="logo-symbol" />
            </div>
            {!isCollapsed && (
              <div className="logo-text">
                <span className="logo-primary">App</span>
                <span className="logo-secondary">Sentry</span>
              </div>
            )}
          </div>

          {/* Desktop Toggle */}
          <button 
            className="nav-toggle desktop-only"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Close */}
          <button 
            className="nav-toggle mobile-only"
            onClick={onToggleMobileMenu}
            title="Close Navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="nav-items">
          {navigationSections.map((section) => (
            <div key={section.title} className="nav-section">
              {!isCollapsed && (
                <div className="nav-section-title">
                  {section.title}
                </div>
              )}
              
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${activeRoute === item.id ? 'active' : ''}`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="nav-item-content">
                    <div className="nav-item-icon">
                      {item.icon}
                    </div>
                    
                    {!isCollapsed && (
                      <div className="nav-item-label">
                        {item.label}
                      </div>
                    )}

                    {item.badge && (
                      <div className={`nav-item-badge ${isCollapsed ? 'collapsed' : ''}`}>
                        {item.badge}
                      </div>
                    )}
                  </div>

                  {/* Tooltip for collapsed mode */}
                  {isCollapsed && hoveredItem === item.id && (
                    <div className="nav-tooltip">
                      <span>{item.label}</span>
                      {item.badge && <span className="tooltip-badge">{item.badge}</span>}
                    </div>
                  )}
                </div>
              ))}
              
              {!isCollapsed && <div className="nav-section-divider" />}
            </div>
          ))}
        </nav>

        {/* Navigation Footer */}
        <div className="nav-footer">
          {/* Dark Mode Toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="theme-toggle-content">
              <div className="theme-icon">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </div>
              {!isCollapsed && (
                <span className="theme-label">
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </span>
              )}
            </div>
          </button>

          {/* User Profile Preview */}
          {!isCollapsed && (
            <div className="user-preview">
              <div className="user-avatar">
                <span>JD</span>
              </div>
              <div className="user-info">
                <div className="user-name">John Doe</div>
                <div className="user-role">Administrator</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="mobile-bottom-tabs">
        {/* Show main navigation items + first items from each section */}
        {navigationSections.slice(0, 1).flatMap(section => section.items).map((item) => (
          <button
            key={item.id}
            className={`bottom-tab ${activeRoute === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            <div className="bottom-tab-icon">
              {item.icon}
              {item.badge && <div className="bottom-tab-badge">{item.badge}</div>}
            </div>
            <span className="bottom-tab-label">{item.label}</span>
          </button>
        ))}
        
        {/* Key section items */}
        {navigationSections.slice(1).map(section => section.items[0]).map((item) => (
          <button
            key={item.id}
            className={`bottom-tab ${activeRoute === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            <div className="bottom-tab-icon">
              {item.icon}
              {item.badge && <div className="bottom-tab-badge">{item.badge}</div>}
            </div>
            <span className="bottom-tab-label">{item.category}</span>
          </button>
        ))}
        
        {/* More Menu */}
        <button
          className="bottom-tab more-tab"
          onClick={onToggleMobileMenu}
        >
          <div className="bottom-tab-icon">
            <Menu size={20} />
          </div>
          <span className="bottom-tab-label">More</span>
        </button>
      </div>
    </>
  );
};