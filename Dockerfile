FROM node:18 as build
ENV NODE_ENV=development

WORKDIR /app

COPY package*.json ./
RUN npm install

ENV NODE_ENV=production

COPY . .

RUN npm run build

FROM node:18-alpine

EXPOSE 80
ENV PORT=80
ENV LOG_LEVEL=trace

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist

CMD ["npm", "start"]
