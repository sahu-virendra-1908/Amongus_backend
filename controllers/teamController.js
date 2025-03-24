const Team = require('../models/team');

exports.updateLocation = async (req, res) => {
  try {
    const { teamName, latitude, longitude } = req.body;

    if (!teamName || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Team name, latitude, and longitude are required' });
    }

    const team = await Team.findOneAndUpdate(
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

    res.status(200).json(team);
  } catch (error) {
    console.error('Error updating team location:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getNearbyTeams = async (req, res) => {
  try {
    const { teamName } = req.params;
    const { maxDistance = 10 } = req.query; // Default 10 meters
    
    const team = await Team.findOne({ teamName, active: true });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found or inactive' });
    }
    
    const allTeams = await Team.find({ 
      teamName: { $ne: teamName },
      active: true
    });
    
    const nearbyTeams = allTeams
      .filter(otherTeam => {
        const distance = team.distanceToTeam(otherTeam);
        return distance <= maxDistance;
      })
      .map(otherTeam => ({
        teamName: otherTeam.teamName,
        location: otherTeam.location,
        distance: team.distanceToTeam(otherTeam)
      }));
    
    res.status(200).json(nearbyTeams);
  } catch (error) {
    console.error('Error getting nearby teams:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.killTeam = async (req, res) => {
  try {
    const { teamName, targetTeamName } = req.body;
    
    const team = await Team.findOne({ teamName, active: true });
    const targetTeam = await Team.findOne({ teamName: targetTeamName, active: true });
    
    if (!team || !targetTeam) {
      return res.status(404).json({ message: 'Team or target team not found or inactive' });
    }
    
    const distance = team.distanceToTeam(targetTeam);
    
    if (distance > 10) {
      return res.status(400).json({ 
        message: 'Target team is too far away', 
        distance 
      });
    }
    
    // Mark target team as inactive (killed)
    targetTeam.active = false;
    await targetTeam.save();
    
    res.status(200).json({ 
      message: 'Team killed successfully',
      killedTeam: targetTeamName 
    });
  } catch (error) {
    console.error('Error killing team:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find({ active: true });
    res.status(200).json(teams);
  } catch (error) {
    console.error('Error getting all teams:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};