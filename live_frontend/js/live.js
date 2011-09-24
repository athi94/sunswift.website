/*
*	LIVE Code
*/


// Live 
var REALTIME = 'Realtime'			// Options: Realtime, Socket, Replay
var LIVEDURATION = 2000;
var REALTIMEUPDATEINTERVAL = 60000;
var POLLINTERVAL = 2000;
var TWITTERINTERVAL = 60000;
var ROUND = 100;
var MAPTYPE = 'Maps';				// Options: Earth, Maps
var PATHPREFIX = '/wp-content/themes/sunswift';
var LIVESERVER = '49.156.18.20:8000';
var MAXARRAY = 1300;
var BATCHLENGTH = 2000;
var dataTypes = [
	{'label':'motorpower','suffix':'W'},
	{'label':'batterypower','suffix':'W'}
];
var polling=true;		// Config variable to set whether we should do polling or buffered realtime
var follow = true;
var allData = Array();
var curkey = 1;
var map_loaded = false;
var map3D_loaded = false;
var map;
var marker;
var ge;
var oldlat = 0;
var oldlong = 0;
var curlat = 0;
var curlong = 0;
var infowindow;
var placemark;
var finalSpeed = 0;
var time=[];
var tmpVal=[];
var updateIv=[]; 			// Burst update interval
var iv;					// Update value interval
var sb;					// Standby interval
var delayiv;
var twitterm=[];
var tinfowindow=[];
var replay_since = new Date();	// new Date();
var lastTime = 1292625914.81;
var timeOffset;
var online=false;
var nextupdate=15;
var lostconniv;
var dots = 0;
var events;


/*
*	State Functions
*/


function initialize () {
	online=true;
	switch (REALTIME) {
		case 'Realtime':
			if (polling) startPolledRealTime();
			else startRealTime();
			break;
		case 'Replay':
			$.getScript("http://"+LIVESERVER+"/events.json?callback=initEvents");
			break;
	}	
}

function stopLive () {
	switch (REALTIME) {
		case 'Realtime':
			clearInterval(iv);	
			clearInterval(sb);	
			for (i in updateIv) clearInterval(updateIv[i]);		
			break;
		case 'Replay':
			clearInterval(iv);
			try {
				clearInterval(polledIv);
			}
			catch (err) {}
			for (i in updateIv) clearInterval(updateIv[i]);
			break;
	}	
};

function standby () {
	if (online) {
		online = false;
		clearInterval(iv);
		for (i in updateIv) clearInterval(updateIv[i]);		
		switch (REALTIME) {
			case "Realtime":
				makeLostConnectionOverlay();
				if (polling) {
					
				}
				else {
					// This is buggy
					getNewestBatch();
					sb = setInterval("getNewestBatch()",30000); // TODO 60000 ?
				}
			break;
			case "Replay":
				makeEndOfDataOverlay();
			break;
		}
	}
}


function changeState(state) {
	REALTIME = state;
	stopLive();
	exitStandby();
	switch(REALTIME) {
		case "Replay":
			$("#offline").fadeOut("fast");
			$("#live_container").animate({opacity:"1"}, "fast");
			$("#slider,#toolbar").fadeIn("fast");
			break;
		case "Realtime":
			$("#slider,#toolbar").fadeOut("fast");
			break;
	}
	initialize();
	//updateValues();
};

function exitStandby() {
	curkey=1;
	//changeState(REALTIME);
	online=true;
	$("#offline").fadeOut("fast");
	$("#live_container").animate({opacity:"1"}, "fast");
	clearTimeout(lostconniv);
	//alert ("Solar car is online");
};



function makeLostConnectionOverlay() {
	//$("#live_container").animate({opacity:"0.5"}, "slow");
	$("#map_canvas").after("<div id='offline'><span id='offline_text'>Searching</span></div>");
	
	///$("#offline")
	$("#offline").fadeIn("slow");
	lostconniv = setInterval(function() {
		lostConnOverlayDots();
	},1000);
	setTimeout(function() {
		if (!online) {
			//$("#offline").append("<br />Check our twitter to see when we'll next be on the road!");
		}
	},3000);
}

function makeEndOfDataOverlay() {
	$("#live_container").animate({opacity:"0.5"}, "slow");
	$("#map_canvas").after("<div id='offline'><span id='offline_text'>End of replay. Click to restart.</span></div>");
	$("#offline").fadeIn("slow").click(function() {
		exitStandby();
		initialize();
	});
}

function lostConnOverlayDots () {
	if (dots==3) {
		$("#offline_text").html("Searching");
		dots=0;
	}
	else {
		$("#offline_text").append(".");
		dots++;
	}
}

/*
*	Polled Realtime Functions
*/

function startPolledRealTime() {
	try {
		clearInterval(polledIv);	
	} 
	catch (err) {};
	var fetchingPollData = false;			// This is a little variable to see whether we are still waiting for a previous request to finish
	polledIv = setInterval(function() {
		if (!fetchingPollData) {
			$.getScript('http://'+LIVESERVER+'/lastupdate.json?callback=updatePolledData');
			fetchingPollData = true;
		}
	},POLLINTERVAL);
};

function updatePolledData(data) {
	fetchingPollData = false;
	if (!data && online) {
		standby();
		return;
	}
	// If we get data but it's greater than a minute old standby (need to verify this is the right move)
	else if (data && ((new Date).getTime()-data.timestamp)>60000) {
		standby();
		$('#data-age').html("Data is "+relative_live_time(data.timestamp));
		return;
	}
	else if (data && !online) {
		exitStandby();
	}
	else if (!data && !online) return;
	//console.log(data);
	
	if (!data.latitude || !data.longitude || data.latitude==0 || data.longitude==0) { 
		try { 
			marker.setMap(map);
			map.setZoom(4); 
		} 
		catch (err) { 
			console.log(err);
		}
	}				
	else {
		data.latitude = Math.round(data.latitude/60000*10000)/10000;
		data.longitude = Math.round(data.longitude/60000*10000)/10000;
		if (map_loaded) updateMap("right", data.speed+" km/h",data.latitude,data.longitude);
		// Add photo if one exists
		var dist = Math.round(distance(data.latitude, data.longitude, "-34.927165", "138.599691", "K")*ROUND)/ROUND;
		if (data.photo) addPhotoToMap(data.latitude,data.longitude,data.photo);
	}

	data.batterypower = Math.round(data.batterypower*ROUND*-1)/ROUND;
	data.motorpower = Math.round(data.motorpower*ROUND*-1)/ROUND;
	data.heatsinktemp = data.heatsinktemp/1000;
	data.motortemp = data.motortemp/1000;
	data.speed = Math.round(data.speed/10)/100;
	data.arraypower = (data.arraypower*-1)/MAXARRAY*100+"%";

	// Change the flash dials
	try {
		$('#speedo object').flash(function(){ this.changeSpeed(data.speed); });
		$('#motortemp object').flash(function(){ this.changeTemperature(data.heatsinktemp); });
		$('#heatsinktemp object').flash(function(){ this.changeTemperature(data.motortemp); });	
	}
	catch (e) {}

	$("#batterypower").html(data.batterypower);
	$("#motorpower").html(data.motorpower);
	$("#distancetime").html('Distance to Adelaide<br /><span class="temp-data">'+dist+'</span><span class="data-unit">Kilometres</span>')
	$("#array-inner-progress").animate({height:data.arraypower},1000);	
	$('#data-age').html("Data is "+relative_live_time(data.timestamp));
	
}

/*
*	Buffered Realtime functions
*/

function startRealTime() {
	stopLive();
	$.getScript('http://'+LIVESERVER+'/time.json?callback=setInternalTime');
	$(document).one('InternalTimeSetEvent',function(eventType,response) {
		var since = getInternalTime()-BATCHLENGTH;
		console.log(since);
		$.get('/live/cloud/api.php?do=lastbatch&time='+since, function(data) {
			if (!data) {
				$.get('/live/cloud/api.php?do=lastupdate', function(data) {
					online=true;
					allData=JSON.parse(data)
					updateValues();
					standby();
				});
			}
			else {
				allData = JSON.parse(data);
				iv = setInterval("updateRealTime()", LIVEDURATION); // TODO: 2000				
			}
		});
	});
}

function getNewestBatch() {
	var time = getInternalTime()-BATCHLENGTH;
	$.get('/live/cloud/api.php?do=lastbatch&time='+time, function(data) {
		if (allData !== data && data) {
			appendNewData(JSON.parse(data));
			clearInterval(sb);
			if (online == false) {
				exitStandby();
			}
			clearInterval(iv);
			iv = setInterval("updateRealTime()", 2000);
		}
		else {
			// Do nothing
		}
	});
}

function appendNewData (data) {
	var out = [];
	var record = false;
	if (allData.length==0) {
		allData=data;
		curkey=1;
		nextupdate = allData.length/2;
		return;
	}
	// Get the last set of data from the array to find out where it ends.
	//var lastindex = (allData.length<2) ? allData.length-1 : allData.length
	var lasttime = allData[allData.length-1].timestamp;
	// Cut off the data we've already displayed
	var tmp = allData.slice(curkey,allData.length);
	// Only take new data
	for (j in data) {
		if (data[j].timestamp == lasttime) record = true;
		if (record)	out.push(data[j]);
	}
	if (data.length>0 && out.length==0 && !record) out = data;
	record = false;
	// Combined the above to arrays together
	allData = tmp.concat(out);
	// Reset the data to play
	curkey = 1;
	nextupdate = allData.length/2;
}

function updateRealTime() {
	if (curkey == Math.floor((allData.length-1)/2)) getNewestBatch();
	updateValues();
}

function setInternalTime(serverResponse) {
	var now = new Date();
	timeOffset = serverResponse.time - now.getTime();
	current_time = serverResponse.time;
	$(document).trigger('InternalTimeSetEvent',[{result:1}]);
};

function getInternalTime() {
	var now = new Date();
	return (now.getTime() + timeOffset);
};
/*
*	Replay Functions
*/
var replayevents;

function getReplayValues(from,to) {
	curkey = 1;
	clearInterval(iv);
	$.ajax({
		url: 'http://'+LIVESERVER+'/replay.json?callback=initReplay&from='+from+'&to='+to,
		dataType: 'script'
	});
};
function initEvents(events) {
	replayevents = events;
	$("#replay_events").html("");
	var options = "";
	var len = events.length;
	for (i=0;i<len;i++) {
		options += "<option title='"+i+"'>"+events[i].title+"</option>";
	}
	$("#replay_events").html(options);
	$("#replay_events option:last").attr("selected","selected");
	getReplayValues(events[len-1].timestamp_from,events[len-1].timestamp_to);
}

function initReplay (data) {
	if (data.length<1) {
		//online=true;
		standby();
		return;
	}
	try {
		allData = data;
		iv = setInterval("updateValues()", LIVEDURATION);
	}
	catch (error) {
		alert ("Error retrieving data");
	}
}

function replaySliderChange() {
	var selectedEvent = $("#replay_events option:selected").attr("title");
	getReplayValues(replayevents[selectedEvent].timestamp_from,replayevents[selectedEvent].timestamp_to)
}

function resetUpdateTimer (delay) {
	clearInterval(iv);
	for (i in updateIv) clearInterval(updateIv[i]);
	LIVEDURATION = delay*-1;
	iv = setInterval("updateValues()", LIVEDURATION);
}

function updateValues() {
	if (curkey < (allData.length) && curkey > 0) {
		online = true;
		if (allData.length==1) curkey--;
		if (curlat == 0 && curlong == 0) { 
			try { 
				map.setZoom(15); 
				marker.setMap(map);
			} catch (err) { }
		}		
		// Map calculations
		curlat = (allData[curkey]["latitude"] == 0) ? curlat : allData[curkey]["latitude"]/60000;
		curlong = (allData[curkey]["longitude"] == 0) ? curlong : allData[curkey]["longitude"]/60000;			
		
		try {
			var oldlat = allData[curkey-1]["latitude"];
			var oldlong = allData[curkey-1]["longitude"];
			var iconDirn = (curlong < allData[curkey-1]["longitude"]) ? "left" : "right";
		}
		catch (err) {}
		
		//var angle = Math.round(heading(longDiff, latDiff, newlat, oldlat)*10)/10;
		//allData[curkey]['heading'] = ((allData % 90) == 0 && allData[curkey-1]['heading']!=="undefined") ? allData[curkey-1]['heading'] : angle;
		allData[curkey]['arraypower'] = allData[curkey]['arraypower']*-1;
		
		// Speed calculations
		
		try {
			var oldspeed = Math.round(allData[curkey-1]["speed"]*100)/100;
		}
		catch (err) {}
		
		var speed = Math.round(allData[curkey]["speed"]*100)/100;
	
		// Add photo if one exists
		if (allData[curkey]["photo"]) addPhotoToMap(curlat,curlong,allData[curkey]["photo"]);
		
		// Change the flash dials
		try {
			$('#speedo object').flash(function(){ this.changeSpeed(allData[curkey]['speed']); });
			$('#motortemp object').flash(function(){ this.changeTemperature(allData[curkey]['heatsinktemp']/1000); });
			$('#heatsinktemp object').flash(function(){ this.changeTemperature(allData[curkey]['motortemp']/1000); });	
		}
		catch (error) {
			console.log(error);
			// No flash installed. We try canvas first, then flash, but maybe throw in just HTML?
			//alert("Cannot adjust dials");
		}
 
		// Distance/Time
		switch (REALTIME) {
			case "Realtime":
				allData[curkey]['distance'] = Math.round(distance(curlat, curlong, "-34.927165", "138.599691", "K")*ROUND)/ROUND;
				$("#distancetime").html('Distance to Adelaide<br /><span class="temp-data">'+allData[curkey]["distance"]+'</span><span class="data-unit">Kilometres</span>')
			break;
			
			case "Replay":
				var datatime = getFormattedDate(allData[curkey]["timestamp"]);
				$("#distancetime").html('Time<br /><span class="time-data">'+datatime+'</span><span class="data-unit">(of data)</span>');
			break;
		}
		// Set the array power
		var arraypower = allData[curkey]['arraypower']/MAXARRAY*100+"%";
		$("#array-inner-progress").animate({height:arraypower},LIVEDURATION);	
		// Update the data age div
		$('#data-age').html("Data is "+relative_live_time(allData[curkey]['timestamp']));
		// Update everything else
		for (var i in dataTypes) {
			var dFrom = (curkey>0) ? allData[curkey-1][dataTypes[i].label] : allData[curkey][dataTypes[i].label];
			updateItem(dataTypes[i].label, dFrom, allData[curkey][dataTypes[i].label], LIVEDURATION, ' '+dataTypes[i].suffix);
		}
		
		if (map_loaded) updateMap(iconDirn, speed+" km/h");
		else if (map3D_loaded) update3DMap(newlat, newlong, iconDirn, speed+" km/h", allData[curkey]['heading']);
		curkey++;
	}
	else {
		switch (REALTIME) {
			case "Realtime": 
				standby();
				break;
			case "Replay":
				//pauseReplay();
				standby();
				break;
		}
		return false;
	}	
}

function addPhotoToMap (latitude,longitude,photo) {
	var photolatlng = new google.maps.LatLng(latitude,longitude);
	var photomarker = new google.maps.Marker({
		position: photolatlng,
		animation: google.maps.Animation.DROP,
		title:'Photo',
		icon:PATHPREFIX+"/images/photoicon.png",
		html:"<div class='map_tweet'><a title='' target='_blank' href='"+photo+"'><img src='"+photo+"' height='229px' width='344px' /></a></div>"
	});
	photomarker.setMap(map);
	photoinfo = new google.maps.InfoWindow();
	// Bind the click event to open the info window
	google.maps.event.addListener(photomarker, 'click', function() {
		if ($("#followmap").attr("checked")=="checked") $("#followmap").click();
		photoinfo.setContent(this.html);	
	    photoinfo.open(map,this);
		$("div.map_tweet a").lightBox({imagePathPrefix:PATHPREFIX});
	});	
}

function relative_live_time (timestamp) {
	var delta = parseInt((replay_since.getTime() - timestamp)/1000);
	//delta = delta + (replay_since.getTimezoneOffset() * 60);
	if (delta < 60) return 'less than a minute old';
	else if(delta < 120) return 'about a minute old';
	else if(delta < (60*60)) return (parseInt(delta / 60)).toString() + ' minutes old';
	else if(delta < (120*60)) return 'about an hour old';
	else if(delta < (24*60*60)) return 'about ' + (parseInt(delta / 3600)).toString() + ' hours old';
	else if(delta < (48*60*60)) return '1 day old';
	else return (parseInt(delta / 86400)).toString() + ' days old';
}

function getFormattedDate (timestamp) {
	var date = new Date(timestamp);
	var day = date.getDate();
	var month="";
	switch (date.getMonth().toString()) {
		case "0":
			month = "Jan";
		break;
		case "1":
			month = "Feb";
		break;
		case "2":
			month = "Mar";
		break;
		case "3":
			month = "Apr";
		break;
		case "4":
			month = "May";
		break;
		case "5":
			month = "Jun";
		break;
		case "6":
			month = "Jul";
		break;
		case "7":
			month = "Aug";
		break;
		case "8":
			month = "Sep";
		break;
		case "9":
			month = "Oct";
		break;
		case "10":
			month = "Nov";
		break;
		case "11":
			month = "Dec";
		break;
	}
	var year = date.getFullYear();
	// hours part from the timestamp
	var hours = date.getHours();
	// minutes part from the timestamp
	var minutes = date.getMinutes();
	// seconds part from the timestamp
	var seconds = date.getSeconds();
	// will display time in 10:30:23 format
	var formattedTime = hours + ':' + minutes + ':' + seconds + '<br /> ' + day+' '+month+' '+year;
	return formattedTime;
}

function updateItem (htmlID, u, v, t, suffix) {
	$('#'+htmlID).html(Math.round(v*ROUND)/ROUND);
	return;
	clearInterval(updateIv[htmlID]);
	time[htmlID]=0;
	var a = ((v-u)/t);	//Fix this
	updateIv[htmlID] = setInterval('burstUpdate("'+htmlID+'",'+a+','+u+');', LIVEDURATION/2);	
}

function burstUpdate (id, a, u) {
	try { 
		$("#"+id).html(Math.round(((a*time[id])+u)*ROUND)/ROUND);
		time[id]+=LIVEDURATION/2;
	}
	catch(err) { }
}

/*
*	Maps specific code
*/

function loadMaps() {
	switch (MAPTYPE) {
		case 'Maps':
			google.load("maps", "3.x", {"callback" : initializeMap, "other_params": "sensor=false"});
			break;
	}
}

function initializeMap () {
	curlat = -25.61;
	curlong = 134.3547;
	// Set the initial parameters for the map
	var latlng = new google.maps.LatLng(curlat, curlong);
	var params = {
     	zoom: 4,
		center: latlng,
		mapTypeId: google.maps.MapTypeId.SATELLITE
	};
	// Create the map
    map = new google.maps.Map(document.getElementById("map_canvas"), params);
	// Create the solar car marker
	marker = new google.maps.Marker({
		position: latlng,
		title:"Sunswift IV"
	});
	// Setup the info window
	infowindow = new google.maps.InfoWindow();
	// Bind the click event to open the info window
	google.maps.event.addListener(marker, 'click', function() {
	    infowindow.open(map,marker);
	});
	// Map has been loaded, so we can start updating the coordinates in updateValues();
	map_loaded = true;
	// Load Twitter markers we get from our twitter feed while on the road.
	loadTwitterMarkers();
}

function updateMap(direction,speed,newlat,newlong) {
	// Create the new position as a maps lat/long
	var newPoint = new google.maps.LatLng(newlat||curlat, newlong||curlong);
	// Center the map on the new location if the button is pressed.
	if ($("#followmap").attr("checked")=="checked") {
		map.setZoom(15);
		map.panTo(newPoint);
	}
	// Set the marker to the new position
	marker.setPosition(newPoint);
    // Change the icon depending on the location
	var icon = (direction=="left") ? PATHPREFIX+"images/left-icon.png" : PATHPREFIX+"images/right-icon.png";
	marker.setIcon(icon);
	marker.setMap(map);
	marker.setClickable=true;
	
	// Update the HTML for the info window
	html = "Speed: "+speed;
	infowindow.setContent(html);
}

function loadTwitterMarkers () {
	var varhtml;
	// Some temp code here
	
	// Get Twitter Feed
	// Filter by set time and date (from, to)
	// Add to map
	// Set up the listeners for the click
	
	for (i=0; i<0; i++) {
		var twitpos = new google.maps.LatLng(-34.948375,(150.53657+(i/1000)));
		twitterm = new google.maps.Marker({
			position: twitpos,
			title:'tweet',
			icon:PATHPREFIX+"/images/alt-tweet-bubble.png",
			html: "<div class='map_tweet'><a title='Luke running back into the car (Tweeted at 12:02pm EST with roughly 1,023km to go)' target='_blank' href='"+PATHPREFIX+"/images/tweetpic.jpg'><img src='"+PATHPREFIX+"/images/tweetpic.jpg' height='229px' /></a></div>"
		});
		twitterm.setMap(map);
		tinfowindow = new google.maps.InfoWindow();

		google.maps.event.addListener(twitterm, 'click', function() {
			tinfowindow.setContent(this.html);	
		    tinfowindow.open(map,this);
			$("div.map_tweet a").lightBox({imagePathPrefix:PATHPREFIX});
			if ($("#followmap").attr("checked")=="checked") $("#followmap").click();
		});
	}
}

/*
*	General lat/long functions
*/

function heading (xDiff, yDiff, oldlat, newlat) {
	var R = 6371; // km
	var dLat = toRad(yDiff);
	var dLon = toRad(xDiff); 
	var y = Math.sin(dLon) * Math.cos(newlat);
	var x = Math.cos(oldlat)*Math.sin(newlat) -
	        Math.sin(oldlat)*Math.cos(newlat)*Math.cos(dLon);
	var angle = Math.atan2(yDiff,xDiff)*180 / Math.PI;
	angle = (angle+360) % 360;
	return angle;
}

function distance(lat1, lon1, lat2, lon2, unit) {
	var radlat1 = Math.PI * lat1/180,
		radlat2 = Math.PI * lat2/180,
		radlon1 = Math.PI * lon1/180,
		radlon2 = Math.PI * lon2/180,
		theta = lon1-lon2,
		radtheta = Math.PI * theta/180,
		dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
			
	dist = Math.acos(dist);
	dist = dist * 180/Math.PI;
	dist = dist * 60 * 1.1515;
	if (unit=="K") { dist = dist * 1.609344 }
	if (unit=="N") { dist = dist * 0.8684 }
	return dist;
}

function toRad(deg) {
	return deg * Math.PI/180;
}

function toDeg (rad) {
	return rad/Math.PI*180;
}

function postError(errorCode) {
	alert(errorCode);
}
