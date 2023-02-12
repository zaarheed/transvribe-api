const {
	loadVideo,
	createEmbeddings
} = require('../controllers/v1.controller');

const router = require('express').Router();

router.get('/load-video', [], loadVideo);
router.get('/create-embeddings', [], createEmbeddings);

module.exports = router;
