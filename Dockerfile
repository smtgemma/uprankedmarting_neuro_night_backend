# # Use Node.js base image
# FROM node:22

# # Set working directory
# WORKDIR /app

# # Copy package.json and lock file
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy rest of the application
# COPY . .

# # Build TypeScript files
# RUN npm run build

# # Expose the port your app runs on
# EXPOSE 5000

# # Start the app
# CMD ["node", "dist/server.js"]


# Use Node.js base image
FROM node:22

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Copy prisma folder before install (to run postinstall prisma generate)
COPY prisma ./prisma

# Install dependencies
RUN npm install

# Copy rest of the application
COPY . .

# Build TypeScript files
RUN npm run build

# Expose the port your app runs on
EXPOSE 5000

# Start the app
CMD ["node", "dist/server.js"]
