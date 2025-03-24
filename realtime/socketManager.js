const socketIo = require('socket.io');
const Team = require('../models/team');

let io;

const setupSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 5000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 10000
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join a team room for targeted updates
    socket.on('joinTeam', (teamName) => {
      socket.join(teamName);
      console.log(`Client ${socket.id} joined team: ${teamName}`);
      
      // Send confirmation back to client
      socket.emit('joinedTeam', { 
        teamName,
        message: `You have joined team ${teamName}` 
      });
    });
    
    // Listen for location updates from clients
    socket.on('updateLocation', async (data) => {
      try {
        const { teamName, latitude, longitude } = data;
        
        if (!teamName || latitude === undefined || longitude === undefined) {
          socket.emit('error', { message: 'Team name, latitude, and longitude are required' });
          return;
        }
        
        const updatedTeam = await Team.findOneAndUpdate(
          { teamName },
          { 
            location: { 
              latitude, 
              longitude, 
              timestamp: new Date() 
            }
          },
          { new: true, upsert: true }
        );
        
        // Broadcast updated location to all clients
        io.emit('locationUpdated', {
          teamName,
          location: {
            latitude,
            longitude,
            timestamp: updatedTeam.location.timestamp
          }
        });
        
        // Confirm update to sender
        socket.emit('locationUpdateConfirmed', {
          teamName,
          location: updatedTeam.location
        });
      } catch (error) {
        console.error('Error handling location update via socket:', error);
        socket.emit('error', { message: 'Error updating location', error: error.message });
      }
    });
    
    // Handle kill request via socket
    socket.on('killTeam', async (data) => {
      try {
        const { teamName, targetTeamName } = data;
        
        if (!teamName || !targetTeamName) {
          socket.emit('error', { message: 'Team name and target team name are required' });
          return;
        }
        
        const team = await Team.findOne({ teamName, active: true });
        const targetTeam = await Team.findOne({ teamName: targetTeamName, active: true });
        
        if (!team || !targetTeam) {
          socket.emit('error', { message: 'Team or target team not found or inactive' });
          return;
        }
        
        const distance = team.distanceToTeam(targetTeam);
        
        if (distance > 10) {
          socket.emit('error', { 
            message: 'Target team is too far away', 
            distance 
          });
          return;
        }
        
        // Mark target team as inactive (killed)
        targetTeam.active = false;
        await targetTeam.save();
        
        // Broadcast kill to all clients
        io.emit('teamKilled', {
          killerTeam: teamName,
          killedTeam: targetTeamName,
          timestamp: new Date()
        });
        
        // Notify the killed team specifically
        io.to(targetTeamName).emit('youWereKilled', {
          killerTeam: teamName,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error handling kill via socket:', error);
        socket.emit('error', { message: 'Error killing team', error: error.message });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  return io;
};

// Function to broadcast nearby teams to a specific team
const broadcastNearbyTeams = async () => {
  try {
    const allTeams = await Team.find({ active: true });
    
    // For each active team, find nearby teams and broadcast
    for (const team of allTeams) {
      const nearbyTeams = allTeams
        .filter(otherTeam => {
          if (otherTeam.teamName === team.teamName) return false;
          const distance = team.distanceToTeam(otherTeam);
          return distance <= 10; // 10 meters threshold
        })
        .map(otherTeam => ({
          teamName: otherTeam.teamName,
          location: otherTeam.location,
          distance: team.distanceToTeam(otherTeam)
        }));
      
      // Broadcast to the specific team's room
      if (io) {
        io.to(team.teamName).emit('nearbyTeams', {
          teamName: team.teamName,
          nearbyTeams,
          timestamp: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error broadcasting nearby teams:', error);
  }
};

// Export socket io instance to use in other parts of the application
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  setupSocket,
  broadcastNearbyTeams,
  getIO
};