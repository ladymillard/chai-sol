FROM node:18-alpine

WORKDIR /app

# Copy root files
COPY package.json package-lock.json start.js server.js ./

# Copy backend
COPY backend/package.json backend/package-lock.json* backend/tsconfig.json backend/
COPY backend/src/ backend/src/

# Copy frontend
COPY frontend/ frontend/

# Install root deps
RUN npm install --production

# Install and build backend
RUN cd backend && npm install && npm run build

# Copy remaining files needed at runtime
COPY lib/ lib/

EXPOSE 8080

CMD ["node", "start.js"]
