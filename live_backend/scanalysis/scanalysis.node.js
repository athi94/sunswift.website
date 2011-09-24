var sys = require('sys'),
	http = require('http'),
	gzip = require('gzip'),
	util = require('util'),
	sqlite3 = require('sqlite3').verbose(),
	UPDATEINTERVAL = 5000,
	TELEMETRYINTERVAL = 2000,
	DATAPOINTINTERVAL = 2000,
	CREDENTIALS = 'SOMETEXT',
	HOST = '49.156.18.20',
	PORT = '80',
	PATH = '/live/cloud/update.php',
	sqlfile = './scandal.sqlite3',
	sqltable = 'canlog',
	liveloop,
	telemetryloop,
	db,
	telData = {};
	
var nodes = {
	speed: {
		node:20,
		channel:6	// TO get
	},
	batterypower: {
		node:10,
		channel:6
	},
	arraypower: {
		node:40,
		channel:1	// Check if this is 1,2,3
	},
	motorpower: {
		node:40,
		channel:3	// Check if this is 1,2,3
	},
	motortemp: {
		node:20,
		channel:13
	},
	heatsinktemp: {
		node:20,
		channel:12
	},
	latitude: {
		node:30,
		channel:1
	},
	longitude: {
		node:30,
		channel:2
	}
};

process.stdout.write('\nSunswift live is starting!\n\n');

/*
*	Database Init
*/
db = new sqlite3.Database(sqlfile,sqlite3.OPEN_READONLY);

db.on('error',function(err) {
	process.stdout.write('Initialising database...\t[ ERROR ]\n');
	console.error(util.inspect(err));
});
db.on('open',function() {
	process.stdout.write('Initialising database...\t[ OK ]\n');
	telemetryloop = setInterval(function() {fetchTelemetryData();},TELEMETRYINTERVAL);
});


/*
*	Telemetry Init
*/
var app = require('express').createServer();

app.get('/recent.json', function(req, res){
  	res.writeHead(200);
	res.end(JSON.stringify(telData[0]));
});

app.listen(8080,'localhost',function() {
	process.stdout.write('Initialising network...\t\t[ OK ]\n');
	telemetryloop = setInterval(function() {fetch();},UPDATEINTERVAL);
});

/*
*	Telemetry Functions
*/

var fetchTelemetryData = function() {
	var sql = "SELECT * FROM `"+sqltable+"` WHERE ciel_timestamp > ((julianday('now') - 2440587.5)*86400000-"+TELEMETRYINTERVAL+") AND message_type=0 ORDER BY ciel_timestamp ASC";	
	db.all(sql,function(err,results) {
		if (err) {
			//process.stdout.write('\t[ ERROR ]\n\n'+err.message+'\n\n');
		}
		else if (results.length==0)	telData = {};
		else telData = processTelemetryData(results);
	});
	return true;
};

var processTelemetryData = function(data) {
	var tmp = [];
	for (i=0;i<data.length;i++) {
		for (j in nodes) {
			if (data[i].source_address == nodes[j].node && data[i].specifics == nodes[j].channel) {
				tmp.push({
					timestamp:data[i].ciel_timestamp,
					node:j,
					value:data[i].value
				});
			}
		}
	};
	var out = [];
	var n = 0;
	for (i=0;i<tmp.length;i++) {
		if (typeof out[n] === "undefined") {
			out[n] = new Object;
		}
		out[n][tmp[i].node]=tmp[i].value;
		out[n]['timestamp']=tmp[i]['timestamp'];
	};
	return out;
};

/*
*	Live-Cloud Interface Functions
*/
var pretendItIs = 1315113303000;
var offset = pretendItIs - (new Date()).getTime();
offset=0;
var fetch = function() {
	var now = (new Date()).getTime();
	now = now+offset;
	var since = now - 30000;
	
	process.stdout.write('\n---- Next batch is between '+formatTime(since)+' and '+formatTime(now)+' ----\n');
	process.stdout.write('Fetching telemetry data...');
	var sql = "SELECT * FROM `"+sqltable+"` WHERE ciel_timestamp > "+since+" AND ciel_timestamp < "+now+" AND message_type=0 ORDER BY ciel_timestamp ASC";
	db.all(sql,function(err,results) {
		if (err) {
			process.stdout.write('\t[ ERROR ]\n\n'+err.message+'\n\n');
		}
		else if (results.length==0) {
			process.stdout.write('nothing to upload, aborting\n');
			return false;
		}
		else {
			process.stdout.write('\t[ DONE ]\n');
			processData(results,since);
		}
	});
	return true;
};


var processData = function(data,start) {
	process.stdout.write('Processing this data...');
	var tmp = [];
	for (i=0;i<data.length;i++) {
		for (j in nodes) {
			if (data[i].source_address == nodes[j].node && data[i].specifics == nodes[j].channel) {
				tmp.push({
					timestamp:data[i].ciel_timestamp,
					node:j,
					value:data[i].value
				});
			}
		}
	};
	var current_time = start + DATAPOINTINTERVAL;
	var out = [];
	var n = 0;
	for (i=0;i<tmp.length;i++) {
		if (tmp[i].timestamp<current_time) {
			if (typeof out[n] === "undefined") {
				out[n] = new Object;
			}
			out[n][tmp[i].node]=(typeof out[n][tmp[i].node]!=="undefined")?(out[n][tmp[i].node]+tmp[i].value)/2:tmp[i].value;
			out[n]['timestamp']=tmp[i]['timestamp'];
		}
		else {
			if (typeof out[n] !== "undefined") n++;
			current_time = current_time + DATAPOINTINTERVAL;
		}
	};
	//var tosend = out[out.length-1];			// To make this less awesome we'll only send the last bit of data.
	process.stdout.write("\t\t[ DONE ]\n");
	process.stdout.write('Compressing output...');
	gzip(JSON.stringify(out),function(err,compressed) {
		if (err) {
			process.stdout.write('\t\t[ ERROR ]\n\n'+err.message+'\n\n');
		}
		else {
			process.stdout.write('\t\t[ DONE ]\n');
			send(compressed);
		}
	});
	return;
};

var send = function(data) {
	process.stdout.write('Uploading to cloud...');
	
	var options = {
	  	host: HOST,
	  	port: PORT,
	  	path: PATH,
	  	method: 'POST',
		headers: {
			'Authorisation':CREDENTIALS,
			'Content-Encoding':'gzip',
			'Content-Length':data.length
		}
	};

	var req = http.request(options, function(res) {
		res.content = '';
	  	res.setEncoding('utf8');
		res.on('error',function(error) {
			process.stdout.write('\t\t[ ERROR ]\n\n'+err.message+'\n');
		});
	  	res.on('data', function (chunk) {
			res.content += chunk;	
		});
		res.on('end',function() {
			try {
				var r = JSON.parse(res.content.toString());
			}
			catch (err) {
				process.stdout.write('\t\t[ ERROR ]\n\nInvalid response from server:\n'+res.content+"\n");
				return;
			}
			if (typeof r !== "object") process.stdout.write('\t\t[ ERROR ]\n\nInvalid response from server:\n'+res.content+"\n");
			else if (r.result==0) {
				process.stdout.write('\t\t[ ERROR ]\n\n'+r.error+'\n');
			}
			else {
				process.stdout.write('\t\t[ DONE ]\n');
				//log(res.content.toString());	
			}
			
		});
	});
	req.on('error',function(err) {
		process.stdout.write('\t\t[ ERROR ]\n\n'+err.message+'\n');
	});
	// write data to request body
	req.end(data);
};

var log = function(response) {
	console.log(response);
};

var formatTime = function(time) {
	var d = new Date(time);
	return d.getHours()+':'+d.getMinutes()+':'+d.getSeconds()+' '+d.getDate()+'-'+(d.getMonth()+1);
};