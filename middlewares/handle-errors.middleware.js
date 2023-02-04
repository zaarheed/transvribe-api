const handleErrors = (err, req, res, _next) => {
	console.log(err);
	if (err.data && err.data.custom && err.data.custom === true) {
		res.status(err.data.statusCode).send({ message: err.data.message });
	}
	else {
		res.status(500).send({ error: 'An unexpected error occurred. Internal Server Error.' });
	}
};

module.exports = handleErrors;