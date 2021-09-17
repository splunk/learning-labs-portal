const os = require('os');

class Retry {
	constructor(max){
		this.max = max;
		this.current = 0;
	}

	async runAsync (func){
		let ret = {
			successful : false
		};
		while(this.current < this.max){
			try {
				ret.result = await func();
				ret.successful = true;
				break;
			}
			catch (err){
				ret.error = err;
				this.current += 1;
			}
		}
		if (ret.successful){
			return ret.result;
		}
		else {
			throw ret.error;
		}
	}

	static runAsync(maxRetry, func){
		const obj = new Retry(maxRetry);
		return obj.runAsync(func);
	}
}

exports.runAsync = Retry.runAsync;