FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY drizzle ./drizzle
COPY src ./src
EXPOSE 8787
# Apply migrations, then start the server.
CMD ["sh", "-c", "bun src/migrate.ts && bun src/index.ts"]
