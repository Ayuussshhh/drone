# Drone Simulation Backend (Node.js)

Production-grade backend server for the Drone Builder & Simulation IDE.

## Architecture

```
backend-node/
├── src/
│   ├── config/           # Configuration & logging
│   │   ├── index.ts      # Environment config
│   │   └── logger.ts     # Winston logger
│   ├── database/         # PostgreSQL with pg-promise
│   │   ├── connection.ts # DB connection
│   │   ├── schema.ts     # Table definitions
│   │   ├── init.ts       # DB initialization
│   │   └── seed.ts       # Seed data
│   ├── middleware/       # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── models/           # TypeScript interfaces
│   │   ├── user.model.ts
│   │   ├── component.model.ts
│   │   ├── drone-frame.model.ts
│   │   ├── user-drone.model.ts
│   │   └── simulation.model.ts
│   ├── routes/           # API routes
│   │   ├── auth.routes.ts
│   │   ├── component.routes.ts
│   │   ├── drone-frame.routes.ts
│   │   ├── user-drone.routes.ts
│   │   └── simulation.routes.ts
│   ├── services/         # Business logic
│   │   ├── auth.service.ts
│   │   ├── email.service.ts
│   │   ├── component.service.ts
│   │   ├── drone-frame.service.ts
│   │   ├── user-drone.service.ts
│   │   ├── simulation.service.ts
│   │   └── physics.service.ts
│   ├── websocket/        # Socket.IO handlers
│   │   └── index.ts
│   ├── tests/            # Jest tests
│   └── index.ts          # Entry point
├── .env.example          # Environment template
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Python Physics Engine (running on port 8000)

## Setup

### 1. Install Dependencies

```bash
cd backend-node
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials and SMTP settings
```

### 3. Setup PostgreSQL Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE drone_simulation;"

# Initialize tables
npm run db:init

# Seed initial data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (revoke token) |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user |

### Components

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/components` | List all components |
| GET | `/api/components/types` | Get component type counts |
| GET | `/api/components/manufacturers` | Get manufacturers |
| GET | `/api/components/type/:type` | Get by type |
| GET | `/api/components/:id` | Get by ID |
| POST | `/api/components` | Create (admin) |
| PUT | `/api/components/:id` | Update (admin) |
| DELETE | `/api/components/:id` | Delete (admin) |

### Drone Frames

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/frames` | List all frames |
| GET | `/api/frames/type/:type` | Get by type |
| GET | `/api/frames/:id` | Get by ID |
| POST | `/api/frames` | Create (admin) |
| PUT | `/api/frames/:id` | Update (admin) |
| DELETE | `/api/frames/:id` | Delete (admin) |

### User Drones

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drones` | Get user's drones |
| GET | `/api/drones/public` | Get community drones |
| GET | `/api/drones/:id` | Get drone by ID |
| POST | `/api/drones` | Create new drone |
| PUT | `/api/drones/:id` | Update drone |
| DELETE | `/api/drones/:id` | Delete drone |
| POST | `/api/drones/:id/clone` | Clone drone |
| POST | `/api/drones/:id/recalculate` | Recalculate metrics |

### Simulations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/simulations` | Get user's simulations |
| GET | `/api/simulations/:id` | Get simulation |
| GET | `/api/simulations/:id/results` | Get results |
| POST | `/api/simulations` | Create simulation |
| POST | `/api/simulations/:id/start` | Start simulation |
| POST | `/api/simulations/:id/cancel` | Cancel simulation |
| DELETE | `/api/simulations/:id` | Delete simulation |

## WebSocket Events

### Client → Server

| Event | Description |
|-------|-------------|
| `start_simulation` | Start new simulation |
| `stop_simulation` | Stop simulation |
| `pause_simulation` | Pause simulation |
| `resume_simulation` | Resume simulation |
| `update_throttles` | Update motor throttles |
| `set_wind` | Update wind parameters |
| `reset_simulation` | Reset to initial state |
| `unity_register` | Register Unity client |
| `forward_to_unity` | Forward data to Unity |

### Server → Client

| Event | Description |
|-------|-------------|
| `state_update` | Real-time state update |
| `simulation_started` | Simulation started |
| `simulation_stopped` | Simulation stopped |
| `simulation_paused` | Simulation paused |
| `simulation_resumed` | Simulation resumed |
| `simulation_reset` | Simulation reset |
| `simulation_error` | Error occurred |
| `unity_feedback` | Results from Unity |

## Database Schema

### Tables

- **users** - User accounts with verification
- **refresh_tokens** - JWT refresh tokens
- **components** - Drone components (motors, propellers, etc.)
- **drone_frames** - Frame templates
- **user_drones** - User's drone designs
- **simulations** - Simulation configurations
- **simulation_results** - Simulation output data

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm test` | Run tests |
| `npm run db:init` | Initialize database |
| `npm run db:seed` | Seed database |
| `npm run lint` | Run ESLint |

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `PORT` - Server port (default: 3001)
- `DB_*` - PostgreSQL connection
- `JWT_*` - JWT configuration
- `SMTP_*` - Email configuration
- `PHYSICS_ENGINE_URL` - Python engine URL
