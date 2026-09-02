FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_DATABASE_PATH=/data/daymark.sqlite
COPY --from=build /app/.output ./.output
COPY --from=build /app/database ./database
VOLUME /data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
