<?php
require_once("config.inc.php");
require_once("Class.Parser.php");
require_once("Class.Live.php");

$live = new Live($config);

$res = opendir("images/");
while ($file = readdir($res)) {
	if ($file =="." || $file =="..") continue;
	$data =  exif_read_data("images/$file");
	$time = @strtotime($data["DateTimeOriginal"]);
	$latlongs = $live->getClosestLatLng($time);
	$in = array(
		'photo_name' => $file,
		'time' => $latlongs[0]['timestamp']
	);
	$live->AppendDBWithPhotos($in);
}


?>