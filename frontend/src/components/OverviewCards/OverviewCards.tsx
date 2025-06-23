import React from 'react';
import {
  Server,
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Heart,
} from 'lucide-react';
import { DashboardStats } from '../../types';
import { useApp } from '../../contexts/AppContext';
import './OverviewCards.css';

interface OverviewCardsProps {
  stats: DashboardStats;
}

interface OverviewCard {
  id: string;
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'indigo';
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ stats }) => {
  const { state } = useApp();
  const { healthMetrics } = state;

  const cards: OverviewCard[] = [
    {
      id: 'total-apps',
      title: 'Total Applications',
      value: healthMetrics?.metrics.totalApplications || stats.totalApplications,
      subValue: 'Active monitoring',
      icon: <Server size={24} />,
      trend: {
        value: 12,
        isPositive: true,
        period: 'vs last month',
      },
      color: 'blue',
    },
    {
      id: 'health-percentage',
      title: 'Health Score',
      value: `${healthMetrics?.metrics.healthPercentage || Math.round(((stats.healthyCount / stats.totalApplications) * 100))}%`,
      subValue: `${healthMetrics?.metrics.healthyApplications || stats.healthyCount}/${healthMetrics?.metrics.totalApplications || stats.totalApplications} healthy`,
      icon: <Heart size={24} />,
      trend: {
        value: 2.5,
        isPositive: true,
        period: 'vs last week',
      },
      color: 'green',
    },
    {
      id: 'avg-response',
      title: 'Avg Response Time',
      value: `${stats.averageResponseTime}ms`,
      subValue: 'Last 24 hours',
      icon: <Clock size={24} />,
      trend: {
        value: 15,
        isPositive: false,
        period: 'vs yesterday',
      },
      color: 'orange',
    },
    {
      id: 'uptime',
      title: 'Overall Uptime',
      value: `${stats.totalUptime}%`,
      subValue: 'This month',
      icon: <Activity size={24} />,
      trend: {
        value: 0.3,
        isPositive: true,
        period: 'vs last month',
      },
      color: 'indigo',
    },
    {
      id: 'sla-compliance',
      title: 'SLA Compliance',
      value: `${stats.slaCompliance}%`,
      subValue: `${Math.round(stats.slaCompliance * stats.totalApplications / 100)} apps meeting SLA`,
      icon: <TrendingUp size={24} />,
      trend: {
        value: 1.2,
        isPositive: true,
        period: 'vs last quarter',
      },
      color: 'purple',
    },
    {
      id: 'issues',
      title: 'Health Issues',
      value: (healthMetrics?.metrics.unhealthyApplications || stats.errorCount) + (healthMetrics?.metrics.unknownApplications || stats.warningCount),
      subValue: `${healthMetrics?.metrics.unhealthyApplications || stats.errorCount} unhealthy, ${healthMetrics?.metrics.unknownApplications || stats.warningCount} unknown`,
      icon: (healthMetrics?.metrics.unhealthyApplications || stats.errorCount) > 0 ? <XCircle size={24} /> : <AlertTriangle size={24} />,
      trend: {
        value: 25,
        isPositive: false,
        period: 'vs last week',
      },
      color: 'red',
    },
  ];

  const getCardColorClasses = (color: string) => {
    const colorMap = {
      blue: 'card-blue',
      green: 'card-green',
      orange: 'card-orange',
      red: 'card-red',
      purple: 'card-purple',
      indigo: 'card-indigo',
    };
    return colorMap[color as keyof typeof colorMap] || 'card-blue';
  };

  return (
    <div className="overview-cards">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`overview-card ${getCardColorClasses(card.color)}`}
        >
          {/* Card Background Effects */}
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>

          {/* Card Content */}
          <div className="card-content">
            {/* Card Header */}
            <div className="card-header">
              <div className="card-icon">
                {card.icon}
              </div>
              <div className="card-trend">
                {card.trend && (
                  <>
                    <div className={`trend-indicator ${card.trend.isPositive ? 'positive' : 'negative'}`}>
                      <Zap size={12} />
                      <span>{card.trend.isPositive ? '+' : '-'}{card.trend.value}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Card Body */}
            <div className="card-body">
              <div className="card-value">
                {card.value}
              </div>
              <div className="card-title">
                {card.title}
              </div>
              {card.subValue && (
                <div className="card-subtitle">
                  {card.subValue}
                </div>
              )}
            </div>

            {/* Card Footer */}
            {card.trend && (
              <div className="card-footer">
                <span className="trend-period">{card.trend.period}</span>
              </div>
            )}
          </div>

          {/* Hover Effects */}
          <div className="card-hover-effect"></div>
        </div>
      ))}
    </div>
  );
};