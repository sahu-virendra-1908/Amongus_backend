// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const cors = require('cors');
const teamRoutes = require('./routes/teamRoutes');
const { setupSocket, broadcastNearbyTeams } = require('./realtime/socketManager');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/locationTracker';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Routes
app.use('/api/teams', teamRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Location Tracker Game API is running' });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocket(server);

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up interval to broadcast nearby teams every second
  setInterval(broadcastNearbyTeams, 1000);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await mongoose.connection.close();
  process.exit(0);
});