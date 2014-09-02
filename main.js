(function () {
	var phantom = require('phantom');

	function Exception(functionName, status) {
		this.functionName = functionName;
		this.status = status;
	}

	phantom.Exception = Exception;

	module.exports = phantom;

	function expand1(object, functionName) {
		var func = object[functionName];
		object[functionName] = function (argument, callback) {
			func(argument, function(result) {
				callback(null, result);
			});
		};
	}

	function checkStatus(functionName, callback) {
		var fn = functionName;
		return function (status) {
			if (status == 'fail') {
				if (callback) {
					callback(new Exception(functionName, status));
				}
			} else {
				if (callback) {
					callback(null, status);
				}
			}
		}
	}

	var create = phantom.create;
	phantom.create = function () {

		var args = Array.prototype.slice.call(arguments, 0);
		var splice = Array.prototype.splice;
		// find the callback, we need it

		var cb;
		var i; // need the index of function
		for (i = 0; i < args.length; i++) {
			if (typeof args[i] === 'function') {
				cb = args[i];
				break;
			}
		}
		args.splice(i, 1);

		var createCallback = function(ph) {

			var createPage = ph.createPage;
			ph.createPage = function (cb) {
				createPage(function (page) {

					var open = page.open;
					page.open = function (url, method, data, callback) {
						if (!callback) {
							callback = method;
							open(url, checkStatus('page.open', callback));
						} else {
							open(url, method, data, checkStatus('page.open', callback));
						}
					};

					var evaluate = page.evaluate;
					page.evaluate = function (siteContext, info, callback) {
						if (!callback) {
							callback = info;
						}
						evaluate(siteContext, function (ret) {
							callback(null, ret);
						}, info);
					};

					var setContent = page.setContent;
					page.setContent = function (url, content, callback) {
						setContent(url, content, checkStatus('setContent', callback));
					}

					/*
					var get = page.get;
					page.get = function (variableName, callback) {
						get(variableName, function (value) {
							callback(null, value);
						});
					}
					*/

					expand1(page, 'get');

					var set = page.set;
					page.set = function (variableName, callback, callback2) {
						if (typeof callback === 'function') {
							// callback is a real callback
							set(variableName, function (returnValue) {
								callback(null, returnValue);
							});
						} else {
							// callback is just a variable
							set(variableName, callback, function(value) { callback2(null, value); });
						}
					};

					if (cb) cb(null, page);
				});
			};

			if (cb) cb(null, ph);
		};

		args.push(createCallback);

		create.apply(this, args);
	};
})();
