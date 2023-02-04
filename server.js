const express = require("express");
const cors = require("cors");
const api = require("./api");
const handleErrors = require("./middlewares/handle-errors.middleware");

const app = express()

app.use(express.json({
	verify: (req, res, buf) => {
		req.rawBody = buf;
	},
	limit: "50mb"
}));

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.options(cors());
app.use(api);

// This needs to come last to handle errors
app.use(handleErrors);

module.exports = app;