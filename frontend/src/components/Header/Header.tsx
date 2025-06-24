import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, User, Menu, LogOut, ChevronDown } from 'lucide-react';
import { User as UserType } from '../../types';
import './Header.css';

interface HeaderProps {
  user: UserType;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onToggleMobileMenu,
  isMobileMenuOpen,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="header modern-header">
      <div className="header-left">
        {/* Mobile Menu Toggle */}
        {onToggleMobileMenu && (
          <button 
            className="mobile-menu-toggle"
            onClick={onToggleMobileMenu}
            title={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          >
            <Menu size={20} />
          </button>
        )}
        
        <div className="header-title">
          <RotateCw className="header-icon" size={24} />
          <h1>AppSentry Platform</h1>
        </div>
      </div>

      <div className="header-center desktop-only">
        {/* Simplified center area - status moved to Dashboard */}
      </div>

      <div className="header-right">
        <div className="user-menu" ref={userMenuRef}>
          <button 
            className="user-info-button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            title="User Menu"
          >
            <User className="user-icon" size={20} />
            <div className="user-details">
              <span className="user-name">{user.displayName}</span>
              <span className="user-role">[{user.role}]</span>
            </div>
            <ChevronDown 
              className={`chevron-icon ${isUserMenuOpen ? 'open' : ''}`} 
              size={16} 
            />
          </button>
          
          {isUserMenuOpen && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-avatar">
                  <User size={32} />
                </div>
                <div className="user-info-detailed">
                  <div className="user-display-name">{user.displayName}</div>
                  <div className="user-email">{user.email}</div>
                  <div className="user-role-badge">{user.role}</div>
                </div>
              </div>
              <div className="user-dropdown-separator"></div>
              <button 
                className="user-dropdown-item logout-item"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};