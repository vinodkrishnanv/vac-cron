const https = require('https');

var uid = '';
var played = 0;
var enabled = true;
var sessionId = '';
var slot = '';
var centerId = '';
var token = '';
var args = process.argv.slice(2);
console.log(args);
var interval = parseInt(args[0]);
var beneficiaries = args[1].split(',');
var min_age_limit = parseInt(args[2]);
var fee_type = args[3];
var dose = parseInt(args[4]);
var mobile = args[5];
var vaccine = args[6];
var cap_dose = 'available_capacity_dose' + dose;
var pincode = args[7];
var date = args[8];

var secret = "U2FsdGVkX19xnhtYyxQwDnfBjDgYP7xthTaaocFR1+1AW8tlIVEm4RPqsVFocnEFbIeULvrkwWGcFZP0Exz1gg==";

function sha256(ascii) {
	function rightRotate(value, amount) {
		return (value>>>amount) | (value<<(32 - amount));
	};
	
	var mathPow = Math.pow;
	var maxWord = mathPow(2, 32);
	var lengthProperty = 'length'
	var i, j; // Used as a counter across the whole file
	var result = ''

	var words = [];
	var asciiBitLength = ascii[lengthProperty]*8;
	
	//* caching results is optional - remove/add slash from front of this line to toggle
	// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
	// (we actually calculate the first 64, but extra values are just ignored)
	var hash = sha256.h = sha256.h || [];
	// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
	var k = sha256.k = sha256.k || [];
	var primeCounter = k[lengthProperty];
	/*/
	var hash = [], k = [];
	var primeCounter = 0;
	//*/

	var isComposite = {};
	for (var candidate = 2; primeCounter < 64; candidate++) {
		if (!isComposite[candidate]) {
			for (i = 0; i < 313; i += candidate) {
				isComposite[i] = candidate;
			}
			hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
			k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
		}
	}
	
	ascii += '\x80' // Append Ƈ' bit (plus zero padding)
	while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
	for (i = 0; i < ascii[lengthProperty]; i++) {
		j = ascii.charCodeAt(i);
		if (j>>8) return; // ASCII check: only accept characters in range 0-255
		words[i>>2] |= j << ((3 - i)%4)*8;
	}
	words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
	words[words[lengthProperty]] = (asciiBitLength)
	
	// process each chunk
	for (j = 0; j < words[lengthProperty];) {
		var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
		var oldHash = hash;
		// This is now the undefinedworking hash", often labelled as variables a...g
		// (we have to truncate as well, otherwise extra entries at the end accumulate
		hash = hash.slice(0, 8);
		
		for (i = 0; i < 64; i++) {
			var i2 = i + j;
			// Expand the message into 64 words
			// Used below if 
			var w15 = w[i - 15], w2 = w[i - 2];

			// Iterate
			var a = hash[0], e = hash[4];
			var temp1 = hash[7]
				+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
				+ ((e&hash[5])^((~e)&hash[6])) // ch
				+ k[i]
				// Expand the message schedule if needed
				+ (w[i] = (i < 16) ? w[i] : (
						w[i - 16]
						+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
						+ w[i - 7]
						+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
					)|0
				);
			// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
			var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
				+ ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj
			
			hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
			hash[4] = (hash[4] + temp1)|0;
		}
		
		for (i = 0; i < 8; i++) {
			hash[i] = (hash[i] + oldHash[i])|0;
		}
	}
	
	for (i = 0; i < 8; i++) {
		for (j = 3; j + 1; j--) {
			var b = (hash[i]>>(j*8))&255;
			result += ((b < 16) ? 0 : '') + b.toString(16);
		}
	}
	return result;
};
function logResp(code, scheduleResponse){
	var resp = JSON.parse(scheduleResponse);
	console.log(resp);
	if(code == 200){
		enabled = false
		played = 1;
		throw new Error("Vaccine Booked!");
	}else{
		enabled = true;
		played = 0;
		return
	}
}
function scheduleSession(code, tokenResponse){
		if(code == 200){
			var resp = JSON.parse(tokenResponse);
			token = resp.token;
			console.log(`Trying to book for ${centerId} (${sessionId}) - ${slot}`);
			postData('/api/v2/appointment/schedule', 
				{
					center_id:centerId,
					session_id:sessionId,
					beneficiaries:beneficiaries,
					slot:slot,
					dose:dose
				},
				logResp
			);
		}else{
			enabled = true;
			played = 0;
			return;
		}
			
}
function validateOtp(code, txnResponse){
		if(code == 200){
			var resp = JSON.parse(txnResponse);
			const readline = require('readline').createInterface({
			  input: process.stdin,
			  output: process.stdout
			});
			readline.question('Input OTP?', otp => {
			  const hash = sha256(otp);
			  console.log('Fetching token!!!')
			  postData('/api/v2/auth/validateMobileOtp', 
				{
					otp: hash,
					txnId: resp.txnId
				},
			  getData
			);
			  readline.close();
			});
		}else{
			enabled = true;
			played = 0;
			return
		}
			
}
function findVaccine(code, resp){
	if(code == 200){
			var centers = JSON.parse(resp).centers;
			if(centers.filter(c => c.fee_type == fee_type).length === 0){
				console.log(`${fee_type} Vaccination Center Not Found!!!`)
				uid = '';
			}else{
				var cen = centers.filter(c => c.fee_type == fee_type).map(c =>c.pincode).join('-');
				centers.filter(c => c.fee_type == fee_type).forEach((c,i) => {
						centerId = c.center_id;
						console.log(`${i+1} ->${c.name}[${c.center_id}](${c.fee_type}),${c.district_name}(${c.pincode})`)	
						c.sessions.forEach((s,j) => {
							console.log(s);
							if((s.min_age_limit >= min_age_limit || s.allow_all_age == true) && s.vaccine == vaccine && s[cap_dose] > 0 && enabled){
							//if(true && enabled){
								sessionId = s.session_id;
								slot =  s.slots[0];
								console.log('Vaccination Available!!!')
								enabled = false;
								console.log(`Trying to book for ${centerId} (${sessionId}) - ${slot}`);
								postData('/api/v2/appointment/schedule', 
									{
										center_id:centerId,
										session_id:sessionId,
										beneficiaries:beneficiaries,
										slot:slot,
										dose:dose
									},
									logResp
								);							
							}else{
								console.log(`No Dose Avaiable  ${s.date}(${s.available_capacity_dose2}) (${s.slots.concat(',')})`);
							}
							console.log('*******************************************************************');
						});
					
				});
				//enabled = true;
				if(uid !== cen){
					uid = cen;
				};
			}
		}else{
			enabled = true;
			played = 0;
			return
		}
			
}
function checkAvailability() {
	if(enabled){
		getData(null, null);	
	}
}
//init();

// cron function
function cron(ms, fn) {
    function cb() {
        clearTimeout(timeout)
        timeout = setTimeout(cb, ms);
		if(enabled){
			fn();
		}
    }
    let timeout = setTimeout(cb, ms)
    return () => {}
}
function postData(url, dataString, callBackFn){
	const data = JSON.stringify(dataString);
	const options = {
		hostname: 'cdn-api.co-vin.in',
		path: url,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			'Content-Length': data.length
		}
	}
	const req = https.request(options, res => {
	  console.log(`statusCode: ${res.statusCode}`)

	  res.on('data', d => {
		  if(res.statusCode === 401 || res.statusCode === 403){
			enabled = false;
			postData('/api/v2/auth/generateMobileOTP', 
				{
					secret:secret, //This is some AES encryption key.Did not explore how this works, so once a day I always refresh this by checking the req from Cowin.
					mobile: mobile
				},
				validateOtp
			);
		  }else{
				callBackFn(res.statusCode, d);
		  }
		
	  })
	})

	req.on('error', error => {
	  console.error(error)
	})

	req.write(data)
	req.end();
}

function getData(c, r){
	if(r != null){
		token = JSON.parse(r).token;
	}
	callBackFn = findVaccine;
	const options = {
		hostname: 'cdn-api.co-vin.in',
		path: `/api/v2/appointment/sessions/calendarByPin?pincode=${pincode}&date=${date}&vaccine=${vaccine}`,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	}
	https.get(options, (res) => {
		var result = '';
		res.on('data', d => {
			result += d
		})
		res.on('end', () => {
		  console.log(result);
		  console.log(res.statusCode);
		  if(res.statusCode === 401 || res.statusCode === 403){
			  enabled = false;
			  postData('/api/v2/auth/generateMobileOTP', 
				{
					secret:secret, 
					mobile: mobile
				},
				validateOtp
			);
			
		  }else{
				callBackFn(res.statusCode, result);
				enabled = true;
		  }
		
	  })
	});
}


// setup cron job
cron(interval, () => checkAvailability())
