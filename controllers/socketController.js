const socketIo = require('socket.io');
const Team = require('../models/team');

let io;

const setupSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Join a team room for targeted updates
    socket.on('joinTeam', (teamName) => {
      socket.join(teamName);
      console.log(`Client joined team: ${teamName}`);
    });
    
    // Listen for location updates from clients
    socket.on('updateLocation', async (data) => {
      try {
        const { teamName, latitude, longitude } = data;
        
        if (!teamName || latitude === undefined || longitude === undefined) {
          return;
        }
        
        await Team.findOneAndUpdate(
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
            longitude
          }
        });
      } catch (error) {
        console.error('Error handling location update via socket:', error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
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
          nearbyTeams
        });
      }
    }
  } catch (error) {
    console.error('Error broadcasting nearby teams:', error);
  }
};

module.exports = {
  setupSocket,
  broadcastNearbyTeams
};