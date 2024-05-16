FROM node:20-bullseye AS builder

# Set the working directory
WORKDIR /app

# Copy the root package.json and package-lock.json
COPY package*.json ./
COPY tsconfig.json ./

# Copy all packages
COPY packages/shared/ packages/shared/
COPY packages/providers/ packages/providers/
COPY packages/action-runner/ packages/action-runner/

# Install dependencies for the entire monorepo
RUN npm ci

# Generate the Prisma client
RUN npm run database:generate

# Build each package individually
RUN npm run build -w @embed/providers
RUN npm run build -w @embed/shared
RUN npm run build -w @embed/action-runner

# Second stage: create the final image
FROM node:20-bullseye

# Set the working directory
WORKDIR /app

# Copy the node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the built files from the builder stage
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/providers ./packages/providers
COPY --from=builder /app/packages/action-runner ./packages/action-runner

# Command to run your application
CMD ["node", "packages/action-runner/dist/index.js"]
