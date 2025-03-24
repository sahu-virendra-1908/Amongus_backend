const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Update team location
router.post('/location', teamController.updateLocation);

// Get nearby teams
router.get('/nearby/:teamName', teamController.getNearbyTeams);

// Kill a team
router.post('/kill', teamController.killTeam);

// Get all active teams
router.get('/', teamController.getAllTeams);

module.exports = router;