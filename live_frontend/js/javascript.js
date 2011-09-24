// Copyright Daniel Friedman 2011
var albums = [];
var videos = [];
var tweets = [];
var CR = 5;		// Corner radius

function $_GET() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function init_after_ready () {
	// Easiest way to add the 'Home' link first in the nav
	$("#navHeader ul:first").prepend("<li><a href='http://www.sunswift.com/'>Home</a></li>");
	// Reflect the main panel image asap.
	try { 
		$("#panel_image img").reflect({height:35}); 
		// Setup rounded corners for the site
		$("#navHeader").corner({ tl: { radius: 0 },	tr: { radius: CR },	bl: { radius: 0 },	br: { radius: 0 }, antiAlias: true,	autoPad: true, validTags: ["div"] });
		$("#body").corner({	tl: { radius: CR }, tr: { radius: CR }, bl: { radius: CR }, br: { radius: CR }, antiAlias: true, autoPad: true, validTags: ["div"] });
		// Create the nice google html button
		$("span.buttons").css({
			'padding' : '5px 20px',
			'font-size' : '14px'
		});
		/*
		$("span.mediaButton").styledButton({
			'orientation' : 'left',
			'action' : function () { showMedia($(this).attr('alt')) },
			'display' : 'block'
		});
		*/
		$("#launchmedia").button().tooltip({effect:"fade"});
		$("#launchlive").button().tooltip({effect:"fade"});
		$("#launchlive").click(function() {$(".tooltip").each(function() {$(this).hide();});launchLive();});
		$("#launchmedia").click(function() {$(".tooltip").each(function() {$(this).hide();});launchMedia();});
		// Create the tooltips for the live/media buttons
	} catch (err) {}
	// Setup our Twitter feed
	$("#twitter").getTwitter({
		userName: "sunswift",
		numTweets: 4,
		loaderText: "Loading Twitter...",
		slideIn: false,
		showHeading: true,
		headingText: "Twitter",
		showProfileLink: true
	});
	// Load up the Google framework
	$.getScript("http://www.google.com/jsapi?key=ABQIAAAA-HMp5qqzmJu3_GQm7YWsjhTmPQATf80Rq88b4VeTi98-rAJ_BRTfcciXC3UtD2NDPWvCjl4VQBXeNQ", function() {
		var gets = $_GET();
		if (gets["live"]=="auto" & gets["delay"]>0) {
			setTimeout("initLive()", gets["delay"]);
		}
		else if (gets["live"]=="auto") launchLive();
	});
	// Load the calendar last
	$("#calendar_container").html('<iframe src="http://www.google.com/calendar/hosted/sunswift.unsw.edu.au/embed?showTitle=0&amp;showDate=0&amp;showTabs=0&amp;showCalendars=0&amp;mode=AGENDA&amp;height=410&amp;wkst=1&amp;bgcolor=%23FFFFFF&amp;src=sunswift.unsw.edu.au_09rfnc8tv6il3lp0016pfehpso%40group.calendar.google.com&amp;color=%2394C7B6&amp;ctz=Australia%2FSydney" style=" border-width:0 " width="100%" height="410" frameborder="0" scrolling="no" id="google_calendar_iframe"></iframe>');
}


function init_after_load() {
	
}

function init_after_twitter() {
	
}

function launchLive() {
	if (navigator.userAgent.indexOf("MSIE")!=-1) alert("Unfortunately we do not have the resources to support Internet Explorer, and cannot guarantee Sunswift Live will function properly.");
	$("#panel_image,#media_container").fadeOut("fast");
	
	$("#mediaHeader").animate({height:"650px"}, "fast", function() {
		
		$(this).children("#live_container").css({display:"block"}); 
		
		$('#speedo').flash({
			swf: PATHPREFIX+'/images/Speedo.swf',
			id: "speedo-flash",
			width: 200,
			height: 192,
			play: false,
			allowscriptaccess: 'always',
			allowfullscreen: 'false',
			wmode: 'transparent'
		});
		
		$('#motortemp').flash({
			swf: PATHPREFIX+'/images/Temp-Guage.swf',
			id:"motortemp-flash",
			width: 100,
			height: 51,
			play: false,
			allowscriptaccess: 'always',
			allowfullscreen: 'false',
			wmode: 'transparent'
		});
		
		$('#heatsinktemp').flash({
			swf: PATHPREFIX+'/images/Temp-Guage.swf',
			id:"heatsink-flash",
			width: 100,
			height: 51,
			play: false,
			allowscriptaccess: 'always',
			allowfullscreen: 'false',
			wmode: 'transparent'
		});
		// Create the reflections of the flash objects
		$("#speedo").append('<img src="'+PATHPREFIX+'/images/Speedometer-grey.jpg" />')
		$("#speedo img").reflect({height:35});
		$('#motortemp').append('<img src="'+PATHPREFIX+'/images/temp-guage-reflect.png" width="100" />')
		$("#motortemp img").reflect({height:25});
		$('#heatsinktemp').append('<img src="'+PATHPREFIX+'/images/temp-guage-reflect.png" width="100" />')
		$("#heatsinktemp img").reflect({height:25});

		$("#array-outer-container").corner({
			tl: { radius: 2 },
			tr: { radius: 2 },
			bl: { radius: 2 },
			br: { radius: 2 },
			antiAlias: true,
			autoPad: true,
			validTags: ["div"]
		});

		// Create the control group actions
		$("#followmap").button();
		$("#livestate").buttonset();
		
		$("input:radio[name=radio]").change(function() {
			changeState($("input:radio[name='radio']:checked").val());
		});
		
		$("#beginning").button({
			text: false,
			icons: { primary: "ui-icon-seek-start" }
		}).click(function() {
			curkey=1;
			updateValues();
			if ($("#play").text()=="play") for (i in updateIv) clearInterval(updateIv[i]);	
		});
		
		$( "#play" ).button({
			text: false,
			icons: { primary: "ui-icon-pause" }
		}).live('click', function() {
			var options;
			if ( $( this ).text() === "pause" ) {
				stopAllIntervals();
				options = {
					label: "play",
					icons: {
						primary: "ui-icon-play"
					}
				};
			} 
			else {
				iv = setInterval("updateValues()", LIVEDURATION);
				options = {
					label: "pause",
					icons: {
						primary: "ui-icon-pause"
					}
				};
			}
			$( this ).button( "option", options );
		});
		$("#slider").slider({
			min: -2000,
			max: -20,
			value: -2000,
		   	slide: function(event, ui) { 
				resetUpdateTimer(ui.value);
			}
		});
		
		

		// Now the meaty bits
		loadMaps();
		//loadEarth();
		//initialize();
		
		$("input:radio[name=radio]").each(function() {
			if ($(this).val()==REALTIME) $(this).click();
		});
		
		
		_gaq.push(['_trackEvent', 'Live', 'Initialised']);
		//twitteriv = setInterval("updateTweetMaps();", TWITTERINTERVAL);
	});
}

function stopAllIntervals() {
	$("#array-inner-progress").stop();	
	clearInterval(iv);
	for (i in updateIv) clearInterval(updateIv[i]);
}

function updateTweetMaps() {
	$.getScript("http://twitter.com/statuses/user_timeline/sunswift.json?callback=checkTwitter&count=5");
}

function launchMedia() {
	// Incase Live is running, stop it by clearing the interval
	stopLive();
	// Get rid of the panel image and the Live container
	$("#panel_image,#live_container").fadeOut("fast");
	// Incase they clicked the galleries button twice, clear the innerHTML of the ul containing both elements.
	$("#album_container,#video_container").hide().children("ul").html("");
	// Add the loading text, and adjust the height of the container.
	$("#mediaHeader").prepend("<div id='medialoading'>Loading...</div>").animate({height:"400px"}, "fast", function() {
		$.getScript("http://graph.facebook.com/UNSWSunswift/albums?callback=setAlbums");
		$.getScript("http://www.vimeo.com/api/v2/sunswift/videos.json?callback=setVideos");
	}).children("#media_container").css({display:"block"});
	_gaq.push(['_trackEvent', 'Media', 'Initialised']);
}
// The following 2 functions are incase facebook loads before vimeo, or vice versa.
function setAlbums (object) {
	albums = object;
	if (videos.length != 0) goForthWithMedia();
}

function setVideos (object) {
	videos = object;
	if (albums.length != 0) goForthWithMedia();
}

function goForthWithMedia () {
	// Remove the loading text
	$("#medialoading").remove();
	// Figure out the height of the media container
	var mediaHeight = 120 + (Math.ceil(albums.data.length/4)+Math.ceil(videos.length/4))*135;
	// Heighten the media container
	$("#mediaHeader").animate({height:mediaHeight+"px"},"fast", function() {
		// Set the innerHTML of the media container
		$("#media_container").html('<div id="album_container"><div class="mediaTitle">Galleries <span id="album-desc"></span></div><ul></ul></div><div id="video_container"><div class="mediaTitle">Videos <span id="video-desc"></span></div><ul></ul></div>');
		// Show both the gallery and video containers
		$("#album_container, #video_container").show();
		// Add the li elements to both containers
		populateAlbums();
		populateVideos();
	});
}

function populateAlbums () {
	// Create the li elements inside the ul
	for (i in albums.data) {
		$("#album_container ul").append("<li><a href='javascript:;' onclick='showGallery("+i+"); return false;'><img src='http://graph.facebook.com/"+albums.data[i].id+"/picture' height='100px' title='"+albums.data[i].name+"' class='thumbnail' /></a></li>");
	}
	// Bind the mouseover events.
	$("#album_container ul li img").each(function() {
		$(this).bind('mouseenter', function() {
			$("#album-desc").html(": "+$(this).attr("title"));
			$(this).animate({opacity:0.65},200);
		}).bind('mouseleave',function() {
			$("#album-desc").html("");
			$(this).animate({opacity:1},200);
		});
	});
	// Reflect the images
	$(".thumbnail").load(function() {
		$("#album_container img").reflect({height:20});
	});
}

function populateVideos () {
	// Create the li elements inside the ul
	for (i in videos) {
		$("#video_container ul").append("<li><a href='javascript:;' onclick='playVideo(\""+i+"\"); return false;'><img src='"+videos[i].thumbnail_medium+"' title='"+videos[i].title+"' width='150px' height='100px' /></a></li>");
	}
	// Bind the mouseover events.
	$("#video_container ul li img").each(function() {
		$(this).bind('mouseenter', function() {
			$("#video-desc").html(": "+$(this).attr("title"));
			$(this).animate({opacity:0.65},200);
		}).bind('mouseleave',function() {
			$("#video-desc").html("");
			$(this).animate({opacity:1},200);
		});
	});
	// Reflect the images
	$("#video_container img").reflect({height:20});
}

function showGallery(i) {
	h = Math.ceil(albums.data[i].count/4)*135+70+"px";
	$("#mediaHeader").animate({height:h},"fast");
	$("#video_container").fadeOut("fast", function() {
		$("#album_container ul").prepend("<div id='loading'>Loading...</div>");
		$("#album_container li").each(function() {
			$(this).fadeOut("fast",function() {
				$(this).remove();
				$("#album_container .mediaTitle").fadeOut("fast",function() {
					$(this).html("<a href='javascript:;' onclick='launchMedia();'>&gt; Click here to go back</a>").fadeIn("fast");
				});
			});
		});
	});
	$.getScript("http://graph.facebook.com/"+albums.data[i].id+"/photos?callback=populateAlbum&limit=9999");
}

function populateAlbum(photos) {
	$("#loading").remove();
	$("#album_container ul").html("");
	for (i in photos.data) {
		$("#album_container ul").append("<li><a href='"+photos.data[i].source+"'><img src='"+photos.data[i].images[1].source+"' class='thumbnail' height='100px' /></a></li>");
	}
	
	$('#album_container ul li a').lightBox({imagePathPrefix:PATHPREFIX});
	$("#album_container ul li a img").each(function() {

		$(this).bind('mouseenter', function() {
			$(this).animate({opacity:0.65},200);
		}).bind('mouseleave',function() {
			$(this).animate({opacity:1},200);
		});
	});
	$("#album_container img").reflect({height:15});
}

function playVideo(i) {
	$("#album_container, #video_container").css("display","none");
	var h = videos[i].height/videos[i].width*780;
	$("#mediaHeader").animate({height:h}, "fast", function() {
		$("#media_container").append('<div id="video"></div>');
		makeBackButton();
		$("#video").flash({
			swf:'http://vimeo.com/moogaloop.swf?autoplay=1',
			width: 780,
			height: h,
			wmode: "transparent",
			flashvars: {
		        clip_id: videos[i].id,
		        portrait: 0,
		        byline: 0,
		        title: 0,
				js_api: 1, // required in order to use the Javascript API
				width: 780,
				height: h
			}
		}).css("display","block");
	});
}

function makeBackButton () {
	$("#mediaHeader").append('<div id="backbutton"><a href="javascript:;">Back to videos<img width="20" style="z-index:9999; position: relative; padding-left: 4px; top: 4px; border: 0" src="'+PATHPREFIX+'/images/back-button.png"/></a></div>');
	
	$("#backbutton").corner({
		tl: { radius: 0 },
		tr: { radius: 6 },
		bl: { radius: 0 },
		br: { radius: 6 },
		antiAlias: true,
		autoPad: true,
		validTags: ["div"]
	});
	
	$("#backbutton").bind("mouseenter", function() {
		$(this).stop(true, false).animate({ left: "0px" }, "fast");
	}).bind("mouseleave", function() {
		$(this).stop(true, false).animate({ left: "-116px" }, "fast");
	}).bind("click", function() {
		$(this).fadeOut("fast", function() {
			$(this).remove();
		});
		$("#video").fadeOut("fast", function() {
			$(this).remove();
			launchMedia();
		});
	});	
	
	$("#backbutton").animate({ left: "-116px" }, 400); 
}

function twitterCallback(twitters) {	
  	var statusHTML = [];
  	for (var i=0; i<twitters.length; i++){
    	var username = twitters[i].user.screen_name;
    	var status = twitters[i].text.replace(/((https?|s?ftp|ssh)\:\/\/[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!])/g, function(url) {
      		return '<a href="'+url+'">'+url+'</a>';
	    }).replace(/\B@([_a-z0-9]+)/ig, function(reply) {
			return  reply.charAt(0)+'<a href="http://twitter.com/'+reply.substring(1)+'" target="_blank">'+reply.substring(1)+'</a>';
	    });
    	statusHTML.push('<li><span>'+status+'</span> <a style="font-size:85%" href="http://twitter.com/'+username+'/statuses/'+twitters[i].id_str+'">'+relative_time(twitters[i].created_at)+'</a></li>');
  	}
	document.getElementById('twitter_update_list').innerHTML = statusHTML.join('');
	tweets = twitters;
}

function relative_time(time_value) {
	var values = time_value.split(" ");
	time_value = values[1] + " " + values[2] + ", " + values[5] + " " + values[3];
	var parsed_date = Date.parse(time_value);
	var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
	var delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
	delta = delta + (relative_to.getTimezoneOffset() * 60);

	if (delta < 60) return 'less than a minute ago';
	else if(delta < 120) return 'about a minute ago';
	else if(delta < (60*60)) return (parseInt(delta / 60)).toString() + ' minutes ago';
	else if(delta < (120*60)) return 'about an hour ago';
	else if(delta < (24*60*60)) return 'about ' + (parseInt(delta / 3600)).toString() + ' hours ago';
	else if(delta < (48*60*60)) return '1 day ago';
	else return (parseInt(delta / 86400)).toString() + ' days ago';
}
function dump(arr,level) {
	var dumped_text = "";
	if(!level) level = 0;
	//The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0;j<level+1;j++) level_padding += "    ";
	
	if (typeof(arr) == 'object') { //Array/Hashes/Objects
		for(var item in arr) {
			var value = arr[item];
	  		if (typeof(value) == 'object') { //If it is an array,
	   			dumped_text += level_padding + "'" + item + "' ...\n";
	   			dumped_text += dump(value,level+1);
	  		} 
			else dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
	 	}
	} 
	else dumped_text = "===>"+arr+"<===("+typeof(arr)+")";	//Stings/Chars/Numbers etc.
	return dumped_text;
}