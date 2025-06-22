import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Trash2,
  Mail,
  Calendar,
  Shield,
  User,
  Crown,
  Settings,
  Eye,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import './TeamPage.css';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  joinedAt: Date;
  lastActive: Date;
  avatar?: string;
  permissions: string[];
  department?: string;
  location?: string;
}

interface TeamPageProps {
  members: TeamMember[];
  onAddMember: () => void;
  onEditMember: (member: TeamMember) => void;
  onDeleteMember: (memberId: string) => void;
  onResendInvite: (memberId: string) => void;
  currentUserRole: string;
}

interface FilterState {
  search: string;
  role: 'all' | 'admin' | 'editor' | 'viewer';
  status: 'all' | 'active' | 'inactive' | 'pending';
  department: 'all' | string;
}

// Mock team data
const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'admin',
    status: 'active',
    joinedAt: new Date('2023-01-15'),
    lastActive: new Date(Date.now() - 30 * 60 * 1000),
    permissions: ['read', 'write', 'admin', 'manage_users', 'manage_settings'],
    department: 'Engineering',
    location: 'San Francisco, CA',
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    email: 'sarah.wilson@company.com',
    role: 'editor',
    status: 'active',
    joinedAt: new Date('2023-03-22'),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
    permissions: ['read', 'write', 'run_tests'],
    department: 'QA',
    location: 'New York, NY',
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike.chen@company.com',
    role: 'editor',
    status: 'active',
    joinedAt: new Date('2023-02-10'),
    lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000),
    permissions: ['read', 'write', 'run_tests', 'configure_apps'],
    department: 'Engineering',
    location: 'Seattle, WA',
  },
  {
    id: '4',
    name: 'Emma Davis',
    email: 'emma.davis@company.com',
    role: 'viewer',
    status: 'active',
    joinedAt: new Date('2023-04-05'),
    lastActive: new Date(Date.now() - 4 * 60 * 60 * 1000),
    permissions: ['read'],
    department: 'Product',
    location: 'Austin, TX',
  },
  {
    id: '5',
    name: 'Alex Johnson',
    email: 'alex.johnson@company.com',
    role: 'viewer',
    status: 'pending',
    joinedAt: new Date('2023-05-20'),
    lastActive: new Date('2023-05-20'),
    permissions: ['read'],
    department: 'Marketing',
    location: 'Chicago, IL',
  },
  {
    id: '6',
    name: 'Lisa Brown',
    email: 'lisa.brown@company.com',
    role: 'editor',
    status: 'inactive',
    joinedAt: new Date('2023-01-08'),
    lastActive: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    permissions: ['read', 'write'],
    department: 'Engineering',
    location: 'Remote',
  },
];

const rolePermissions = {
  admin: ['read', 'write', 'admin', 'manage_users', 'manage_settings', 'run_tests', 'configure_apps'],
  editor: ['read', 'write', 'run_tests', 'configure_apps'],
  viewer: ['read'],
};

export const TeamPage: React.FC<TeamPageProps> = ({
  members = mockTeamMembers,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onResendInvite,
  currentUserRole = 'admin',
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    role: 'all',
    status: 'all',
    department: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set(members.map(m => m.department).filter(Boolean));
    return Array.from(depts);
  }, [members]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !member.name.toLowerCase().includes(searchLower) &&
          !member.email.toLowerCase().includes(searchLower) &&
          !member.department?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Role filter
      if (filters.role !== 'all' && member.role !== filters.role) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && member.status !== filters.status) {
        return false;
      }

      // Department filter
      if (filters.department !== 'all' && member.department !== filters.department) {
        return false;
      }

      return true;
    });
  }, [members, filters]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = filteredMembers.length;
    const active = filteredMembers.filter(m => m.status === 'active').length;
    const pending = filteredMembers.filter(m => m.status === 'pending').length;
    const inactive = filteredMembers.filter(m => m.status === 'inactive').length;
    const admins = filteredMembers.filter(m => m.role === 'admin').length;
    const editors = filteredMembers.filter(m => m.role === 'editor').length;
    const viewers = filteredMembers.filter(m => m.role === 'viewer').length;

    return { total, active, pending, inactive, admins, editors, viewers };
  }, [filteredMembers]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="role-icon admin" size={16} />;
      case 'editor':
        return <Edit3 className="role-icon editor" size={16} />;
      case 'viewer':
        return <Eye className="role-icon viewer" size={16} />;
      default:
        return <User className="role-icon" size={16} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="status-icon active" size={14} />;
      case 'inactive':
        return <XCircle className="status-icon inactive" size={14} />;
      case 'pending':
        return <Clock className="status-icon pending" size={14} />;
      default:
        return <AlertCircle className="status-icon" size={14} />;
    }
  };

  const formatLastActive = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const handleSelectMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const canManageUsers = currentUserRole === 'admin';

  return (
    <div className="team-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <Users size={24} />
            Team Members
            <span className="count">({stats.total})</span>
          </h1>
          <p>Manage team access and permissions for your applications</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          {canManageUsers && (
            <button className="btn primary" onClick={onAddMember}>
              <Plus size={16} />
              Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Team Statistics */}
      <div className="team-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Members</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon admin">
            <Crown size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.admins}</div>
            <div className="stat-label">Admins</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon editor">
            <Edit3 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.editors}</div>
            <div className="stat-label">Editors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon viewer">
            <Eye size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.viewers}</div>
            <div className="stat-label">Viewers</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-bar">
        <div className="search-input">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search team members..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Role</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value as any })}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedMembers.size > 0 && canManageUsers && (
        <div className="bulk-actions">
          <span>{selectedMembers.size} member(s) selected</span>
          <div className="bulk-buttons">
            <button className="btn secondary">
              <Mail size={16} />
              Send Message
            </button>
            <button className="btn danger">
              <Trash2 size={16} />
              Remove
            </button>
            <button 
              className="btn ghost"
              onClick={() => setSelectedMembers(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="members-table">
        <div className="table-header">
          <div className="table-cell checkbox-cell">
            {canManageUsers && (
              <input
                type="checkbox"
                checked={selectedMembers.size === filteredMembers.length}
                onChange={handleSelectAll}
              />
            )}
          </div>
          <div className="table-cell">Member</div>
          <div className="table-cell">Role</div>
          <div className="table-cell">Status</div>
          <div className="table-cell">Department</div>
          <div className="table-cell">Last Active</div>
          <div className="table-cell">Joined</div>
          <div className="table-cell">Actions</div>
        </div>

        {filteredMembers.map((member) => {
          const isSelected = selectedMembers.has(member.id);

          return (
            <div 
              key={member.id} 
              className={`table-row ${isSelected ? 'selected' : ''} ${member.status}`}
            >
              <div className="table-cell checkbox-cell">
                {canManageUsers && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectMember(member.id)}
                  />
                )}
              </div>
              
              <div className="table-cell member-cell">
                <div className="member-avatar">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} />
                  ) : (
                    <div className="avatar-initials">
                      {getInitials(member.name)}
                    </div>
                  )}
                </div>
                <div className="member-info">
                  <div className="member-name">{member.name}</div>
                  <div className="member-email">{member.email}</div>
                  {member.location && (
                    <div className="member-location">{member.location}</div>
                  )}
                </div>
              </div>
              
              <div className="table-cell role-cell">
                <div className="role-badge">
                  {getRoleIcon(member.role)}
                  <span className={`role-text ${member.role}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="table-cell status-cell">
                <div className="status-badge">
                  {getStatusIcon(member.status)}
                  <span className={`status-text ${member.status}`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="table-cell department-cell">
                <span className="department-badge">
                  {member.department || 'N/A'}
                </span>
              </div>
              
              <div className="table-cell last-active-cell">
                <div className="datetime">
                  <Clock size={12} />
                  {formatLastActive(member.lastActive)}
                </div>
              </div>
              
              <div className="table-cell joined-cell">
                <div className="datetime">
                  <Calendar size={12} />
                  {member.joinedAt.toLocaleDateString()}
                </div>
              </div>
              
              <div className="table-cell actions-cell">
                {member.status === 'pending' && canManageUsers && (
                  <button
                    className="btn secondary small"
                    onClick={() => onResendInvite(member.id)}
                    title="Resend Invitation"
                  >
                    <Mail size={14} />
                    Resend
                  </button>
                )}
                {canManageUsers && (
                  <button
                    className="btn secondary small"
                    onClick={() => onEditMember(member)}
                    title="Edit Member"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                )}
                <button className="btn ghost small" title="More Options">
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission Matrix */}
      <div className="permissions-section">
        <h2>
          <Shield size={20} />
          Role Permissions
        </h2>
        <div className="permissions-matrix">
          <div className="matrix-header">
            <div className="permission-label">Permission</div>
            <div className="role-column">Viewer</div>
            <div className="role-column">Editor</div>
            <div className="role-column">Admin</div>
          </div>
          
          {[
            { key: 'read', label: 'View Applications' },
            { key: 'write', label: 'Edit Applications' },
            { key: 'run_tests', label: 'Run Tests' },
            { key: 'configure_apps', label: 'Configure Applications' },
            { key: 'manage_users', label: 'Manage Users' },
            { key: 'manage_settings', label: 'Manage Settings' },
            { key: 'admin', label: 'Full Admin Access' },
          ].map(permission => (
            <div key={permission.key} className="matrix-row">
              <div className="permission-label">{permission.label}</div>
              <div className="permission-cell">
                {rolePermissions.viewer.includes(permission.key) ? (
                  <CheckCircle className="permission-granted" size={16} />
                ) : (
                  <XCircle className="permission-denied" size={16} />
                )}
              </div>
              <div className="permission-cell">
                {rolePermissions.editor.includes(permission.key) ? (
                  <CheckCircle className="permission-granted" size={16} />
                ) : (
                  <XCircle className="permission-denied" size={16} />
                )}
              </div>
              <div className="permission-cell">
                {rolePermissions.admin.includes(permission.key) ? (
                  <CheckCircle className="permission-granted" size={16} />
                ) : (
                  <XCircle className="permission-denied" size={16} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredMembers.length === 0 && (
        <div className="empty-state">
          <Users size={48} className="empty-icon" />
          <h3>No team members found</h3>
          <p>
            {filters.search || filters.role !== 'all' || filters.status !== 'all' || filters.department !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Get started by inviting your first team member.'}
          </p>
          {!filters.search && filters.role === 'all' && filters.status === 'all' && filters.department === 'all' && canManageUsers && (
            <button className="btn primary" onClick={onAddMember}>
              <Plus size={16} />
              Invite Team Member
            </button>
          )}
        </div>
      )}
    </div>
  );
};