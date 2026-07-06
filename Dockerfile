FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build with tsc if needed, or run tsx directly
CMD ["npx", "tsx", "server.ts"]
