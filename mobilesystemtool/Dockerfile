# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/mobiletoolsservice/service/v1
ARG VITE_BASE_PATH=/mobiletools/
ARG VITE_TIGER_MOCK=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_TIGER_MOCK=$VITE_TIGER_MOCK
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache wget
COPY --from=build /app/dist /usr/share/nginx/html/mobiletools
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
