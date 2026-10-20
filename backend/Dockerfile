FROM node:22.23.3-bookworm-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json /app/backend/
COPY backend/tsconfig.json /app/backend/tsconfig.json
COPY db/index.ts /app/db/index.ts

WORKDIR /app/backend
RUN npm ci

COPY backend/src /app/backend/src
RUN npm run build

EXPOSE 3765
CMD ["npm", "start"]
