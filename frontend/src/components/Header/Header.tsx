import React from 'react';
import { RotateCw, User, Menu } from 'lucide-react';
import { User as UserType } from '../../types';
import './Header.css';

interface HeaderProps {
  user: UserType;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
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
        <div className="user-info">
          <User className="user-icon" size={20} />
          <div className="user-details">
            <span className="user-name">{user.displayName}</span>
            <span className="user-role">[{user.role}]</span>
          </div>
        </div>
      </div>
    </header>
  );
};