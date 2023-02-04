class ApplicationError extends Error {
	constructor(err, message) {
		super(message);

		// todo: error logging here
		
		this.message = message;
		
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
	
	getGlobalProperties() {
		return { custom: true, message: this.message };
	}
}

class CustomError extends ApplicationError {
	constructor(status = 500, message) {
		const msg = message !== undefined ? message : "An unknown error occured";
		super(null, msg);
		
		this.data = { statusCode: status, ...super.getGlobalProperties() };
	}
}


class AuthenticationError extends ApplicationError {
	constructor(err, message) {
		const msg = message !== undefined ? message : 'Please authenticate!';
		super(err, msg);
		
		this.data = { type: 'Auth', statusCode: 401, ...super.getGlobalProperties() };
	}
}


class AuthorizationError extends AuthenticationError {
	constructor(err, message) {
		super(err, message);

		// Provide the error details, we have 401.
		this.data = { ...super.getGlobalProperties(), ...{ statusCode: 401 } };
	}
}

class BadRequestError extends ApplicationError {
	constructor(err, msg) {
		super(err, !msg ? 'The action can not be completed with the request data provided.' : msg);
		
		this.data = { type: 'Query Params', statusCode: 400, ...super.getGlobalProperties() };
	}
}

class ValidationError extends ApplicationError {
	constructor(err, msg) {
		super(err, !msg ? 'A field is missing or invalid, or updates are invalid, or a file is invalid! The action can not be completed with the data or request body provided.' : msg);

		// Provide the error details, we have 400.
		this.data = { type: 'Validation', statusCode: 400, ...super.getGlobalProperties() };
	}
}


class ImageProcessingError extends ApplicationError {
	constructor(err) {
		super(err, 'Could not upload image.');

		// Provide the error details, we have 500.
		this.data = { type: 'Image Processing', statusCode: 500, ...super.getGlobalProperties() };
	}
}



class NotImplementedError extends ApplicationError {
	constructor(err) {
		super(err, "Not implemented");

		// Provide the error details, we have 500.
		this.data = { type: 'Not Implemented', statusCode: 501, ...super.getGlobalProperties() };
	}
}


class QueryBuilderError extends ApplicationError {
	constructor(err, msg) {
		super(err, !msg ? 'The action can not be completed with the request data provided.' : msg);
		
		this.data = { type: 'Query Params', statusCode: 400, ...super.getGlobalProperties() };
	}
}


class ResourceNotFoundError extends ApplicationError {
	constructor(err, resource) {
		const msg = resource ? `Resource "${resource}" was not found.` : 'Resource not found.';
		super(err, msg);

		// Provide the error details, we have 404.
		this.data = { type: 'Resource Not Found', statusCode: 404, ...super.getGlobalProperties() };
	}
}

class PaymentIntentNotFound extends ApplicationError {
	constructor(err, message) {
		const msg = message ? message : "Original payment not found";
		super(err, msg);

		// Provide the error details, we have 404.
		this.data = { type: 'Resource Not Found', statusCode: 404, ...super.getGlobalProperties() };
	}
}


module.exports = {
	ApplicationError,
	AuthenticationError,
	AuthorizationError,
	BadRequestError,
	CustomError,
	ValidationError,
	ImageProcessingError,
	NotImplementedError,
	QueryBuilderError,
	ResourceNotFoundError,
	PaymentIntentNotFound
};