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

# Copy application source (only required files for runtime)
COPY server.js ./
COPY config/ ./config/
COPY public/ ./public/
COPY src/ ./src/
COPY translations/ ./translations/
COPY views/ ./views/

# Create non-root user directories
RUN mkdir -p logs uploads && \
    chown -R node:node /home/node/app

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
COPY --from=production-deps /home/node/app/node_modules ./node_modules

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
