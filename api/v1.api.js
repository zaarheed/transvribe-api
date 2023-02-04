const {
	loadVideo,
} = require('../controllers/v1.controller');

const router = require('express').Router();

router.get('/load-video', [], loadVideo);

module.exports = router;
