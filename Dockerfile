FROM node:14-alpine
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
RUN ls -a
RUN npm install
RUN npm run build

FROM node:14-alpine

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# Install Doppler CLI
RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.8004D9FF50437357.key' -O /etc/apk/keys/cli@doppler-8004D9FF50437357.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' | tee -a /etc/apk/repositories && \
    apk add doppler

WORKDIR /app
COPY package.json ./
RUN npm install --only=production
COPY --from=0 /app/dist .
RUN npm install pm2 -g
#EXPOSE 80
CMD ["doppler", "run", "--", "pm2-runtime","bot.js"]

