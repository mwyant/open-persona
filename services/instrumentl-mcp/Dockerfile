FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install --no-fund --no-audit
RUN npm run build

EXPOSE 7000

CMD ["node", "dist/index.js"]
