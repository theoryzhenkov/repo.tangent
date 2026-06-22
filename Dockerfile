FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
EXPOSE 8787
CMD ["bun", "src/index.ts"]
