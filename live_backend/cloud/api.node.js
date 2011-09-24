var sys = require("sys"),  
    http = require("http"),
	url = require('url'),
	Client = require('mysql').Client,	
	DATABASE = require('/etc/live/config.js').database,
	TABLE = require('/etc/live/config.js').table,
	DBUSER = require('/etc/live/config.js').user,
	DBPASS = require('/etc/live/config.js').pass,
	PATHPREFIX = require('/etc/live/config.js').pathprefix,
	twitter = require('/etc/live/config.js').twitter,
	PORT = require('/etc/live/config.js').port,
	gzip = require('gzip'),
	lastData = {},
	lastDataString = "";
	UPDATEINTERVAL = 2000;
	
server = http.createServer(function(request, response){
	// Parse the url
	var path = PATHPREFIX+url.parse(request.url).pathname;
	var _GET = url.parse(request.url, true).query;
	
	switch (path) {
		case '/events.json':
			var callback = (_GET.callback) ? _GET.callback : '';	
			sendEvents(request,response,callback);
			break;
		case '/time.json':
			var out = (_GET.callback) ? _GET.callback+'('+JSON.stringify({time:(new Date()).getTime()})+');' : JSON.stringify({time:(new Date()).getTime()});
			response.writeHead(200);
			response.end(out);
			break;
		case '/lastupdate.json':
			var callback = (_GET.callback) ? _GET.callback : '';
			lastUpdateRequest(request,response,callback);
			break;
		case '/replay.json':
			if (!_GET.from || !_GET.to) {
				response.writeHead(400);
				response.end(JSON.stringify({result:0,error:"Malformed Request"}));
				break;
			}
			var callback = (_GET.callback) ? _GET.callback : '';
			handleReplayRequest(_GET.from,_GET.to,request,response,callback);
			break;
		default: send404(response);	
			break;
	}
});
server.listen(PORT);
server.on('error', function (e) {
    console.error("Ignoring exception: " + e);
});
console.log("Sunswift Live now serving requests.");

function connect() {
	var client = new Client();
	client.user = 'root';
	client.host = 'localhost';
	client.password = '';
	return client;
}

var pretendOffset = 1315113303000-(new Date().getTime());
pretendOffset=0;

function lastUpdateRequest(req,res,callback) {
	// 1315098141664
	//1315094398189
	var now = (pretendOffset+(new Date().getTime()));
	if (!lastData || typeof lastData !== "object" || Object.keys(lastData).length==0) fetchAndSendLastUpdate(req,res,callback);
	else if (now>lastData.timestamp+UPDATEINTERVAL) fetchAndSendLastUpdate(req,res,callback);
	else {
		if (callback) {
			res.writeHead(200,{'Content-Type':'application/javascript'});
			res.end(callback+"("+lastDataString+');');
		}
		else {
			res.writeHead(200,{'Content-Type':'application/json'});
			res.end(lastDataString);
		}
	}
};

function fetchAndSendLastUpdate(req,res,callback,client) {
	var client = connect();
	client.connect(function() {
		client.useDatabase(DATABASE,function() {
			var now = (pretendOffset+(new Date().getTime()));
			client.query("SELECT * FROM `"+TABLE+"` WHERE timestamp < "+now+" ORDER BY id DESC LIMIT 1",function(err,results) {
				client.end();
				if (err) {
					console.error(err);
					res.writeHead(200);
					res.end(JSON.stringify({result:0,error:'Database Error',id:0}));
				}
				else {
					if (results.length==1) {
						lastData = results[0];
						lastDataString = JSON.stringify(results[0]);
					}
					if (callback) {
						res.writeHead(200,{'Content-Type':'application/javascript'});
						res.end(callback+"("+lastDataString+');');
					}
					else {
						res.writeHead(200,{'Content-Type':'application/json'});
						res.end(lastDataString);
					}
				}
			});
		});
	});
}

function sendEvents(request,response,callback) {
	var client = connect();
	client.connect(function() {
		client.useDatabase(DATABASE,function() {
			var sql = "SELECT title,timestamp_from,timestamp_to FROM `events` ORDER BY timestamp DESC";
			client.query(sql,function(error,results) {
				client.end();
				if (error) {
					response.writeHead(200);
					response.write(JSON.stringify({result:0,error:"Database Error"}));
				}
				else {
					var json = JSON.stringify(results);
					var out = (callback) ? callback + "(" + json + ");" : json;
					response.writeHead(200);
					response.end(out);

				};
			});
		});
	});
}

function handleReplayRequest(from, to, request, response, callback) {
	try {
		var f = Number(from);
		var t = Number(to);
	}
	catch (err) {
		response.writeHead(400);
		response.end('Invalid Request');
	}
	if (isNaN(f) || isNaN(t) || !f || !t) {
		response.writeHead(400);
		response.end("Invalid Request");
		return false;
	}
	// This is what happens when the Project Manager tries to code.
	var client = connect();
	client.connect(function() {
		client.useDatabase(DATABASE,function() {
			var sql = client.format("SELECT * FROM "+TABLE+" WHERE speed BETWEEN 1000 AND 120000 AND timestamp > ? && timestamp < ? ORDER BY timestamp ASC;",[f,t]);
			client.query(sql, function(error, results, fields) {
				client.end();
				if (error) {
					res.writeHead(200);
					res.end(JSON.stringify({result:0,error:'Database Error',id:0}));
					sys.log(error.message);
				}
				else {
					// Prepare the JSON to go out the door
					var json = JSON.stringify(results);
					// If it's a JSONP request, wrap the JSON in the callback function name
					var uncompressed = (callback) ? callback + "(" + json + ");" : json;
					// If the browser can handle gzip
					try { 
						var handlesgzip = request.headers['accept-encoding'].indexOf("gzip");
					}
					catch (err) { 
						var handlesgzip = -1;
					}
					if (handlesgzip>-1) {
						// Compress the JSON
						gzip(uncompressed, function(gziperror, compressed) {
							// If there is an error, log it and then send the data uncompressed.
							if (gziperror) {
								sys.log(gziperror.message);	
								sendUncompressedData(response, uncompressed);	
							} 
							else {
								// If all is peachy, send the compressed data
								console.log("Sent "+compressed.length+" bytes of data");
								response.writeHead(200, {
									'Content-Encoding':'gzip',
									'Content-Length': compressed.length,
									'Content-Type': 'application/json',
									'Access-Control-Allow-Origin:': '*'
								});
								response.write(compressed);
								response.end("\n");								
							}
						});
					}
					else sendUncompressedData(response, uncompressed);
				}
			});
		});
	});
}

function sendUncompressedData (res, data) {
	res.writeHead(200, {
		'Content-Length': data.length,
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin:': '*'							
	});
	res.write(data);
	res.end("\n");
	console.log("Sent "+data.length+"bytes of data");
} 

function send404(response){
  response.writeHead(404);
  response.write('Action not supported.');
  response.end();
};