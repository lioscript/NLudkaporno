FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copy lib packages (shared workspace dependencies)
COPY lib/ ./lib/

# Copy only the api-server artifact
COPY artifacts/api-server/ ./artifacts/api-server/

# Remove Replit-specific pnpm settings not supported by standard pnpm.
# Uses node to safely parse and remove only the minimumReleaseAge settings
# without touching the catalog entries (which also contain '@replit/' names).
RUN node -e " \
  const fs = require('fs'); \
  let c = fs.readFileSync('pnpm-workspace.yaml', 'utf8'); \
  c = c.replace(/^minimumReleaseAge:.*\n/m, ''); \
  c = c.replace(/^minimumReleaseAgeExclude:\n([ \t]+[^\n]*\n)*/m, ''); \
  fs.writeFileSync('pnpm-workspace.yaml', c); \
"

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the api-server
WORKDIR /app/artifacts/api-server
RUN pnpm run build

EXPOSE 8080

CMD ["node", "--experimental-sqlite", "--enable-source-maps", "./dist/index.mjs"]
