const uniqid = require('uniqid');

const generate = () => {
	return uniqid();
}

const generateShort = () => {
	return uniqid.time();
}

module.exports = {
	generate,
	generateShort
}
