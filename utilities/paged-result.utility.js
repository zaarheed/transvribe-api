exports.getPaged = function (array, reqPage = 1, reqPageSize = 10) {

	const page = +reqPage;
	const pageSize = +reqPageSize;

	let result = {
		currentPage: page,
		pageSize: pageSize,
		rowCount: array.length
	};

	const pageCount = Math.ceil(result.rowCount / pageSize);

	result.pageCount = pageCount; 

	const skip = (page - 1) * pageSize;
	
	result.results = array.slice(skip, skip + pageSize); 

	return result;
}

exports.formatPaged = function (array, options) {

	const page = (+options.skip / options.limit) + 1;
	const pageSize = +options.limit;
	const rowCount = +options.rowCount;
	const pageCount = Math.ceil(+rowCount / +options.limit);

	let result = {
		currentPage: page,
		pageSize: pageSize,
		rowCount,
		pageCount,
		results: array
	};

	return result;
}
