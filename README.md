# Google Live API Voice Conversation Platform

A real-time voice conversation platform powered by Google's Live API (Gemini 2.0 Flash) with support for text input, push-to-talk, and continuous voice conversation modes.

## Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui + Zustand
- **Backend**: Node.js + Express + Socket.io + SQLite
- **Development**: Vite + ESLint + Prettier + Docker + pnpm workspaces

## Project Structure

```
card6/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API services
│   │   ├── stores/       # Zustand state management
│   │   └── utils/        # Utility functions
│   └── package.json
├── backend/               # Node.js backend service
│   ├── src/
│   │   ├── api/          # REST API routes
│   │   ├── websocket/    # Socket.io handlers
│   │   ├── services/     # Business logic
│   │   └── db/           # Database models
│   └── package.json
├── shared/                # Shared TypeScript types
│   └── src/types/
└── docker-compose.yml     # Local development environment
```

## Prerequisites

- Node.js 18+ 
- pnpm 8+
- Docker and Docker Compose (optional, for containerized development)
- Google AI Studio API key

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Install dependencies for all workspaces
pnpm install

# Build shared types
pnpm --filter shared build
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit .env files and add your Google API key
# Required: GOOGLE_API_KEY=your_google_api_key_here
```

### 3. Start Development Environment

**Option A: Using pnpm (recommended)**
```bash
# Start both frontend and backend in development mode
pnpm dev
```

**Option B: Using Docker**
```bash
# Start with Docker Compose
pnpm docker:up

# View logs
pnpm docker:logs

# Stop containers
pnpm docker:down
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Development Scripts

### Root Level Commands

```bash
# Start development servers for frontend and backend
pnpm dev

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean

# Setup project (install + build shared)
pnpm setup
```

### Docker Commands

```bash
# Start development environment
pnpm docker:up

# Stop development environment
pnpm docker:down

# Rebuild containers
pnpm docker:build

# View container logs
pnpm docker:logs
```

### Package-Specific Commands

```bash
# Frontend only
pnpm --filter frontend dev
pnpm --filter frontend build
pnpm --filter frontend test

# Backend only
pnpm --filter backend dev
pnpm --filter backend build
pnpm --filter backend test

# Shared types only
pnpm --filter shared build
pnpm --filter shared dev
```

## Core Features

### Voice Input Modes

1. **Text Input**: Direct text messaging
2. **Push-to-Talk**: Hold button to record, release to send
3. **Continuous**: Always listening with voice activity detection

### Audio Configuration

- **Input Format**: 16kHz 16-bit PCM
- **Output Format**: 24kHz 16-bit PCM  
- **Real-time bidirectional audio streaming**
- **Automatic reconnection handling**

### Conversation Management

- **Thread Management**: Create and manage conversation threads
- **Message History**: Persistent conversation history
- **Context Management**: Configurable context window
- **Real-time Transcription**: Live speech-to-text display

### Voice Settings

- **Speed Control**: 0.5x - 2.0x playback speed
- **Volume Control**: 0-100% volume adjustment
- **Voice Selection**: Multiple voice options (API dependent)

## API Integration

### Google Live API Setup

1. Get your API key from [Google AI Studio](https://aistudio.google.com/)
2. Add to your `.env` file:
   ```
   GOOGLE_API_KEY=your_api_key_here
   ```
3. The platform handles WebSocket connections and audio streaming automatically

### WebSocket Events

The platform uses Socket.io for real-time communication:

- `join-thread`: Join a conversation thread
- `send-message`: Send text/audio message
- `start-recording` / `stop-recording`: Control audio recording
- `audio-chunk`: Stream audio data
- `message-received`: Receive AI responses
- `transcription-update`: Live transcription updates

## Development Guidelines

### Code Style

- **ESLint + Prettier**: Automated code formatting
- **TypeScript**: Strict type checking enabled
- **Import Organization**: Absolute imports with path mapping

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm --filter backend test:coverage
```

### Type Safety

- Shared types in `/shared` package
- Strict TypeScript configuration
- Runtime type validation with Joi

## Troubleshooting

### Common Issues

**Microphone Access**
- Ensure browser permissions are granted
- Check HTTPS requirements for production

**WebSocket Connection Fails**
- Check firewall and proxy settings
- Verify CORS configuration
- Ensure backend server is running

**Audio Playback Issues**
- Check browser autoplay policies
- Verify audio codec support
- Test with different browsers

**API Errors**
- Verify Google API key validity
- Check API quotas and limits
- Review network connectivity

### Debugging

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Check service health
curl http://localhost:3001/health

# Test WebSocket connection
# Use browser developer tools Network tab
```

## Production Deployment

**Important**: This is currently an MVP for local development only.

For production deployment, consider:

- **HTTPS Configuration**: Required for microphone access
- **WebSocket Proxy**: Configure reverse proxy for Socket.io
- **Database Migration**: Switch from SQLite to PostgreSQL
- **Load Balancing**: Implement horizontal scaling
- **Security**: Enhanced authentication and rate limiting
- **Monitoring**: Production logging and metrics

## Contributing

1. Follow the established code style (ESLint + Prettier)
2. Write tests for new features
3. Update documentation for API changes
4. Ensure type safety with TypeScript

## License

This project is for development and testing purposes.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs for errors
3. Test with minimal configuration
4. Check browser compatibility

---

**Ready to start development!** Both frontend and backend engineers can begin implementing features immediately with `pnpm dev`.