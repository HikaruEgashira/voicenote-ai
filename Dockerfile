FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod

# Copy application code and dependencies
COPY apps/server ./apps/server
COPY packages ./packages
COPY tsconfig.json ./

# Install dev dependencies for build
RUN pnpm install --frozen-lockfile

# Build main application (CommonJS for Lambda compatibility)
RUN npx esbuild apps/server/_core/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=cjs \
    --outfile=dist/index.js

# Set the handler - Lambda expects handler function name
CMD ["dist/index.handler"]
