/**
 * Copyright 2021 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. 
 */

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