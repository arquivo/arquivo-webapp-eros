# Multi-stage Dockerfile for arquivo-webapp-eros

# Stage 1: Base image with common dependencies
FROM node:20-alpine3.21 AS base
LABEL maintainer="Arquivo.pt"

# Install dumb-init and curl for proper signal handling and healthchecks
RUN apk add --no-cache dumb-init curl

# Set working directory
WORKDIR /home/node/app

# Copy package files
COPY package*.json ./

# Stage 2: Dependencies layer (shared between dev and prod)
FROM base AS dependencies

# Security: Copy application source as read-only to prevent tampering
# --chmod=444: Files are read-only (r--r--r--) - prevents modification of source code
# --chmod=555: Directories are read-only + executable (r-xr-xr-x) - allows traversal but not modification
# --chown=node:node: Ensures files are owned by non-root user
COPY --chown=node:node --chmod=444 server.js ./
COPY --chown=node:node --chmod=555 config/ ./config/
COPY --chown=node:node --chmod=555 public/ ./public/
COPY --chown=node:node --chmod=555 src/ ./src/
COPY --chown=node:node --chmod=555 translations/ ./translations/
COPY --chown=node:node --chmod=555 views/ ./views/

# Create writable directories for application runtime needs
# chmod 755: Owner can write, others can read/execute (rwxr-xr-x)
RUN mkdir -p logs uploads && \
    chown -R node:node /home/node/app/logs /home/node/app/uploads && \
    chmod 755 /home/node/app/logs /home/node/app/uploads

# Stage 3: Development image (extends dependencies)
FROM dependencies AS development
ENV NODE_ENV=development

# Install all dependencies (including devDependencies)
RUN npm ci

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Healthcheck using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start development server with nodemon
CMD ["npm", "run", "dev"]

# Stage 4: Production dependencies (separate layer for optimization)
FROM base AS production-deps
ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --only=production

# Stage 5: Production image (extends dependencies, uses prod node_modules)
FROM dependencies AS production
ENV NODE_ENV=production

# Copy production dependencies from production-deps stage
# Use --chown to ensure correct ownership when copying
COPY --from=production-deps --chown=node:node /home/node/app/node_modules ./node_modules

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Healthcheck using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start production server
CMD ["npm", "start"]
