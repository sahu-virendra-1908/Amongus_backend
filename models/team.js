const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
   
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  active: {
    type: Boolean,
    default: true
  }
});

// Method to calculate distance between two teams
teamSchema.methods.distanceToTeam = function(otherTeam) {
  // Earth's radius in meters
  const R = 6371e3;
  const lat1 = this.location.latitude * Math.PI / 180;
  const lat2 = otherTeam.location.latitude * Math.PI / 180;
  const deltaLat = (otherTeam.location.latitude - this.location.latitude) * Math.PI / 180;
  const deltaLon = (otherTeam.location.longitude - this.location.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Return distance in meters
  return R * c;
};

module.exports = mongoose.model('Team', teamSchema);