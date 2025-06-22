# AppSentry Dashboard

React frontend for the AppSentry health monitoring platform with the exact wireframe layout from the PRD specifications.

## Features

✅ **Complete Wireframe Implementation**
- Header with platform title, user info, and status overview badges
- Application grid layout with 4-column desktop view
- Application cards with health status, response times, and uptime
- Right sidebar with test progress and recent activity panels
- Application configuration modal with tabbed interface
- Reports dashboard with executive summary and analytics
- Fully responsive mobile layout

✅ **Real-time Updates**
- WebSocket integration for live test progress
- Real-time activity feed
- Live status indicator animations

✅ **Interactive Components**
- Filter applications by status (All/Healthy/Warning/Error)
- Run tests for all applications or individual apps
- Configure application settings with comprehensive modal
- View detailed reports and analytics

## Component Structure

```
src/
├── components/
│   ├── Header/                 # Top navigation with status overview
│   ├── ApplicationsGrid/       # Main grid layout with filters
│   ├── ApplicationCard/        # Individual app status cards
│   ├── Sidebar/               # Test progress & activity panels
│   ├── ApplicationModal/      # Configuration modal with tabs
│   ├── ReportsModal/          # Analytics dashboard
│   └── Dashboard/             # Main dashboard container
├── hooks/
│   └── useWebSocket.ts        # Real-time WebSocket integration
├── services/
│   └── api.ts                 # API service layer
├── types/
│   └── index.ts               # TypeScript type definitions
└── data/
    └── mockData.ts            # Mock data for development
```

## Wireframe Compliance

The dashboard implements the exact layout specifications from Section 7:

### Desktop Layout (1920x1080)
- ✅ Header with activity icon, user info, status badges, action buttons
- ✅ 4-column application grid with status indicators
- ✅ Right sidebar with test progress and activity panels
- ✅ Application cards showing health, uptime, SLA status

### Mobile Layout (375x812)
- ✅ Responsive single-column layout
- ✅ Collapsible sidebar panels
- ✅ Touch-friendly buttons and interactions

### Interactive States
- ✅ Ready state with "Run All Tests" button
- ✅ Running state with progress bar and current app
- ✅ Complete state with results summary

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm start
```
Opens http://localhost:3000 with hot reload enabled.

### Build
```bash
npm run build
```
Creates optimized production build in `build/` folder.

### Environment Variables
Create `.env.local` file:
```
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=http://localhost:3001
```

## API Integration

The dashboard connects to the Express API backend:
- `/api/applications` - CRUD operations for applications
- `/api/tests` - Test execution and monitoring
- WebSocket events for real-time updates

Switch from mock data to live API by uncommenting the API calls in `Dashboard.tsx`.

## Design System

### Colors
- **Healthy**: Green (#10b981)
- **Warning**: Amber (#f59e0b) 
- **Error**: Red (#ef4444)
- **Primary**: Blue (#3b82f6)

### Typography
- **Headers**: 600 weight
- **Body**: 500 weight for labels, 400 for content
- **Monospace**: For technical values

### Responsive Breakpoints
- **Desktop**: 1280px+ (4 columns)
- **Tablet**: 768px-1279px (2 columns)
- **Mobile**: <768px (1 column)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Optimized bundle size with code splitting
- Lazy loading for modals and complex components
- Efficient re-renders with React hooks
- WebSocket connection management