# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy backend package files first for better caching
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/

# Install ALL dependencies (including dev) for building
RUN cd backend && npm ci

# Copy Prisma schema and generate client
COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Copy backend source code
COPY backend/src ./backend/src

# Build the backend application
RUN cd backend && npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files from original location
COPY --chown=nodejs:nodejs backend/package*.json ./

# Install only production dependencies and generate Prisma client
RUN npm ci --only=production && \
    npm cache clean --force

# Copy Prisma files and generate client
COPY --chown=nodejs:nodejs backend/prisma ./prisma
RUN npx prisma generate

# Copy built application from builder stage
COPY --chown=nodejs:nodejs --from=builder /app/backend/dist ./dist

# Copy necessary config files
COPY --chown=nodejs:nodejs .env.example ./.env.example

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3000, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Start the application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]