# Everest - Sports Event Platform

## Overview

Everest is a full-stack web application that connects sports enthusiasts for local events and games. The platform allows users to discover, create, and join sports activities in their area while providing real-time chat functionality for event coordination.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state
- **Build Tool**: Vite with custom configuration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Real-time Communication**: WebSocket server for chat functionality
- **Payment Processing**: Stripe integration for event bookings

### Database Architecture
- **Database**: PostgreSQL with Neon serverless connection
- **ORM**: Drizzle ORM with schema-first approach
- **Migration Strategy**: Drizzle Kit for schema management

## Key Components

### Authentication System
- **Provider**: Replit Auth using OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **User Management**: Automatic user creation and profile management
- **Security**: HTTP-only cookies with secure flag in production

### Event Management
- **Sports Support**: Badminton, Basketball, Soccer, Tennis, Volleyball, Table Tennis
- **Event Creation**: Rich form with sport-specific configurations
- **Booking System**: Stripe-powered payment processing
- **Capacity Management**: Real-time tracking of available spots

### Real-time Features
- **WebSocket Server**: Built-in WebSocket support for live chat with real-time message delivery
- **Event Chat**: Per-event chat rooms for participants with optimistic message sending
- **Connection Management**: User-specific connection tracking
- **Read Status**: Message read receipts with automatic unread count updates
- **Chat Controls**: Chatroom deletion, date separators, and dynamic message bubble sizing

### Payment System
- **Provider**: Stripe with React Stripe.js
- **Flow**: Client-side payment element with server-side confirmation
- **Security**: Server-side payment intent creation and validation

## Data Flow

### User Authentication Flow
1. User clicks login → redirected to Replit Auth
2. OAuth callback processes user data
3. User profile created/updated in PostgreSQL
4. Session established with secure cookies

### Event Booking Flow
1. User selects event → payment modal opens
2. Stripe payment element collects payment data
3. Server creates payment intent and processes payment
4. Booking record created with payment confirmation
5. Real-time update of event capacity

### Chat System Flow
1. WebSocket connection established on authentication
2. User joins event-specific chat rooms
3. Messages broadcast to all room participants
4. Message history stored in PostgreSQL

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection management
- **@stripe/stripe-js & @stripe/react-stripe-js**: Payment processing
- **@tanstack/react-query**: Server state management
- **drizzle-orm**: Database operations and schema management

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **date-fns**: Date manipulation and formatting

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Production build bundling
- **vite**: Development server and build tool

## Deployment Strategy

### Environment Configuration
- **Development**: Replit environment with hot reload
- **Production**: Autoscale deployment with build process
- **Database**: Neon PostgreSQL with connection pooling

### Build Process
1. **Frontend**: Vite builds React app to `dist/public`
2. **Backend**: esbuild bundles server code to `dist/index.js`  
3. **Assets**: Static files served from build directory

### Runtime Configuration
- **Port**: 5000 (mapped to external port 80)
- **Sessions**: PostgreSQL-backed with 7-day TTL
- **WebSocket**: Integrated with HTTP server

## Changelog
- June 22, 2025. Initial setup
- June 22, 2025. Removed Stripe payment system, fixed startup issues, improved UI components
- June 22, 2025. Added comprehensive event management with host controls and booking requests
- June 22, 2025. Fixed event deletion foreign key constraints and accessibility warnings
- June 22, 2025. Implementing map functionality, real-time chat, mobile responsive design, event filtering, and player count fixes
- June 22, 2025. Implemented distance-based event sorting and date filter checkboxes
- June 22, 2025. Added comprehensive timezone-aware date handling throughout the application
- June 22, 2025. Implemented comprehensive booking status system (requested/accepted/rejected/cancelled) with proper player count logic that only increments when bookings are accepted
- June 24, 2025. Completed advanced chat system with real-time messaging, read status tracking, optimistic sending with loading states, dynamic message sizing, date separators, and chatroom deletion functionality
- June 26, 2025. Fixed critical chat message display issues by resolving API data flow problems, query caching conflicts, and duplicate message sending. Chat now properly displays existing messages and prevents double-sending.
- June 27, 2025. Implemented comprehensive map view with interactive event markers using Leaflet. Features include event clustering when multiple events are at same location, proximity-based grouping, custom sport-specific icons, detailed popups with event information, user location display, and automatic map bounds fitting. Fixed location search CORS issues with server-side proxy.

## User Preferences

Preferred communication style: Simple, everyday language.