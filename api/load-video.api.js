const {
	loadVideo,
} = require('../controllers/load-video.controller');

const router = require('express').Router();

router.get('/', [], loadVideo);

module.exports = router;
