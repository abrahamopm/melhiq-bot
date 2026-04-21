# Use official Node.js image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create logs directory
RUN mkdir -p logs

# Start the bot
CMD [ "node", "bot.js" ]
