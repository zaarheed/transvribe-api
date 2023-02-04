const _dotenv = require('dotenv').config();

module.exports = {
	environment: process.env.ENVIRONMENT,
	openaiApiKey: process.env.OPENAI_API_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY
}
