/* eslint-disable no-unused-vars */
const server = require("./server");
const port = process.env.PORT || 8000;

server.listen(port, async () => {
	console.log('We are live on ' + port);
})

module.exports = server;