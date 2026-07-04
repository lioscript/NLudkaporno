FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copy lib packages (shared workspace dependencies)
COPY lib/ ./lib/

# Copy only the api-server artifact
COPY artifacts/api-server/ ./artifacts/api-server/

# Remove Replit-specific pnpm settings that are not supported by standard pnpm
RUN sed -i '/minimumReleaseAge/d' pnpm-workspace.yaml && \
    sed -i '/minimumReleaseAgeExclude/d' pnpm-workspace.yaml && \
    sed -i "/'@replit/d" pnpm-workspace.yaml && \
    sed -i "/stripe-replit-sync/d" pnpm-workspace.yaml

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the api-server
WORKDIR /app/artifacts/api-server
RUN pnpm run build

EXPOSE 8080

CMD ["node", "--experimental-sqlite", "--enable-source-maps", "./dist/index.mjs"]
