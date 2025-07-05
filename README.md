# Everest - Sports Event Platform

A sophisticated sports event booking platform that connects sports enthusiasts for local events and games with real-time location tracking and interactive features.

## 🏆 Features

### Core Functionality
- **Event Discovery**: Browse and filter sports events by sport type, skill level, date, and location
- **Real-time Location Tracking**: Get accurate distance calculations to events with live GPS updates
- **Interactive Map View**: Visualize events on an interactive map with clustering and detailed popups
- **Event Management**: Create, edit, and manage sports events with capacity tracking
- **Booking System**: Request to join events with host approval workflow
- **Real-time Chat**: Live messaging system for event coordination and communication

### Sports Supported
- Badminton
- Basketball  
- Soccer
- Tennis
- Volleyball
- Table Tennis

### Advanced Features
- **Location-based Sorting**: Events automatically sorted by distance from your location
- **Timezone Awareness**: All dates and times handled with user's local timezone
- **Mobile Responsive**: Optimized for mobile devices with touch-friendly interface
- **Permission Management**: Smart location permission handling with persistent preferences
- **WebSocket Communication**: Real-time updates for chat and event changes

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for client-side routing
- **shadcn/ui** components built on Radix UI
- **Tailwind CSS** for styling
- **TanStack Query** for server state management
- **Leaflet.js** for interactive mapping
- **Vite** for development and building

### Backend
- **Node.js** with Express.js
- **TypeScript** with ESM modules
- **WebSocket** server for real-time features
- **Replit Auth** with OpenID Connect
- **Express sessions** with PostgreSQL storage

### Database & ORM
- **PostgreSQL** with Neon serverless connection
- **Drizzle ORM** with schema-first approach
- **Drizzle Kit** for schema management

## 🏗️ Project Structure

```
├── client/src/
│   ├── components/
│   │   ├── events/          # Event management components
│   │   ├── chat/            # Real-time chat system
│   │   ├── map/             # Interactive map components
│   │   ├── layout/          # Navigation and sidebar
│   │   └── ui/              # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions and configs
│   └── pages/               # Application pages
├── server/
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # Database operations
│   ├── replitAuth.ts        # Authentication setup
│   └── index.ts             # Server entry point
├── shared/
│   └── schema.ts            # Database schema and types
└── drizzle.config.ts        # Database configuration
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Replit account (for authentication)

### Environment Variables
```env
DATABASE_URL=your_postgresql_connection_string
REPLIT_CLIENT_ID=your_replit_client_id
REPLIT_CLIENT_SECRET=your_replit_client_secret
SESSION_SECRET=your_session_secret
```

### Installation
```bash
# Install dependencies
npm install

# Set up database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## 🌟 Key Features Deep Dive

### Real-time Location Tracking
- **High Accuracy GPS**: Uses device GPS with high accuracy mode
- **Distance Calculations**: Haversine formula for precise distance measurements
- **Live Updates**: Real-time location tracking with 5-meter sensitivity
- **Permission Management**: Smart handling of location permissions with localStorage persistence

### Interactive Map
- **Event Clustering**: Multiple events at same location are grouped together
- **Custom Markers**: Sport-specific icons for easy identification
- **Detailed Popups**: Rich event information with booking actions
- **User Location**: Shows current user position on map
- **Auto-fitting**: Map automatically adjusts bounds to show all events

### Chat System
- **WebSocket-based**: Real-time messaging with instant delivery
- **Event-specific**: Separate chat rooms for each event
- **Read Receipts**: Message read status tracking
- **Optimistic Updates**: Messages appear instantly with loading states
- **Date Separators**: Clear message organization by date

### Event Management
- **Rich Creation Form**: Sport-specific configurations and settings
- **Capacity Tracking**: Real-time player count management
- **Booking Workflow**: Request-based joining with host approval
- **Status Management**: Complete booking lifecycle (requested/accepted/rejected/cancelled)

## 🔧 Development

### Database Operations
```bash
# Push schema changes to database
npm run db:push

# Generate new migration
npm run db:generate

# View database studio
npm run db:studio
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Apply schema changes
- `npm run db:generate` - Generate migration files

## 🚀 Deployment

The application is designed for deployment on Replit with:
- **Autoscale**: Automatic scaling based on traffic
- **Zero Config**: Ready to deploy without additional setup
- **PostgreSQL**: Neon database with connection pooling
- **WebSocket Support**: Real-time features work out of the box

## 📱 Mobile Experience

- **Responsive Design**: Mobile-first approach with touch optimization
- **Location Services**: GPS tracking works seamlessly on mobile devices
- **Touch Gestures**: Map and UI elements optimized for touch interaction
- **Progressive Enhancement**: Core features work without JavaScript

## 🎯 Future Enhancements

- [ ] Push notifications for booking updates
- [ ] Payment integration for paid events
- [ ] User ratings and review system
- [ ] Social features and friend connections
- [ ] Event recommendations based on preferences
- [ ] Advanced filtering and search
- [ ] Calendar integration
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- **Replit** - For hosting and authentication services
- **Neon** - For PostgreSQL database hosting
- **shadcn/ui** - For beautiful, accessible UI components
- **Leaflet** - For interactive mapping functionality

---

Built with ❤️ for the sports community