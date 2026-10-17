[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=arquivo_responsive-design&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=arquivo_responsive-design)

# Getting Started

## Prerequisites

- Docker and Docker Compose (recommended), OR
- Node.js 20+ (for local development)

## Configuration

Review `config/default.properties` to configure API endpoints and other settings before running the application. `config/custom-environment-variables.json` lists the settings that environment variables can override, among them:

- `EXPRESS_TRUST_PROXY` (`express.trust.proxy`): which reverse proxies may set the client IP with `X-Forwarded-For` (Express "trust proxy"). Empty by default: no proxy is trusted. Behind a proxy, set it to the exact number of proxy hops (e.g. `1`) or to the proxy addresses/subnets (e.g. `172.16.0.0/12`). `true` is refused at startup: it would let any client choose its IP with `X-Forwarded-For`. A higher hop count, `0.0.0.0/0` or `::/0` would do the same.
- `CITATION_SAVER_RATE_LIMIT_MAX` / `CITATION_SAVER_RATE_LIMIT_WINDOW_MS`: at most that many Citation Saver submissions per client IP in each window. Empty or `0` (the default) turns the limit off; only turn it on once the deployment forwards a trustworthy client IP, or every client shares one limit.
- `CITATION_SAVER_UPLOAD_TEMP_FOLDER_PATH`: folder for uploads in progress. By default `.citationsaver-tmp` next to the upload folder, on the writable uploads volume. It must not be inside the upload folder. Anything that reads `uploads/` recursively should skip it.

## Docker (Recommended)

The project includes a multi-stage Dockerfile optimized for both development and production environments.

### Development Mode

Run with hot-reload enabled (using nodemon):

```bash
# Start the development container
docker compose up

# Rebuild after dependency changes
docker compose up --build

# Stop containers
docker compose down
```

The application will be available at: http://localhost:3000/

**Features:**
- Hot-reload with nodemon (code changes reflect automatically)
- Volume mounting for live development
- All devDependencies installed for testing
- Healthcheck enabled (checks every 30s)

### Production Mode

Run optimized production build:

```bash
# Build and start production container
SESSION_SECRET=$(openssl rand -hex 32) docker compose -f docker-compose.prod.yml up --build

# Run in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop containers
docker compose -f docker-compose.prod.yml down
```

**Production optimizations:**
- Minimal image size (production dependencies only)
- Runs as non-root user for security
- No volume mounting (immutable container)
- Auto-restart on failure
- Healthcheck for monitoring

### Docker Architecture

The Dockerfile uses a multi-stage build:
- **base**: Node.js 20 Alpine with dumb-init and curl
- **dependencies**: Shared layer with application files
- **development**: Extends dependencies with devDependencies
- **production-deps**: Production dependencies only
- **production**: Optimized final image

### Troubleshooting

**Rebuild without cache:**
```bash
docker compose build --no-cache
```

**Access container shell:**
```bash
docker compose exec node sh
```

**View container logs:**
```bash
docker compose logs -f node
```

**Check container health:**
```bash
docker compose ps
```

## Node (Local Development)

Run directly with Node.js (requires Node.js 20+):

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Run in production mode
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run accessibility tests (WCAG 2.1 AA — no external APIs needed)
npm run test:a11y

# Run tests inside the development container
docker compose -f docker-compose.yml run node npm run test
```

## Health Check

Both Docker and production deployments include health checks that verify the application responds on port 3000. The healthcheck runs every 30 seconds with a 10-second timeout and 3 retries.

