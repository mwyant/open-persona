FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json eslint.config.js ./
COPY src ./src

RUN npm install --no-fund --no-audit
RUN npm run build

EXPOSE 8000

CMD ["npm", "run", "start"]
