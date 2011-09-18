<?php
require_once("config.inc.php");
require_once("Class.Parser.php");
require_once("Class.Live.php"); 

$live = new Live($config);
$headers = getallheaders();

if ($headers['Authorisation']!==$live->credentials) {
	$out = array(
		'result' => 0,
		'error' => 'Invalid Authorisation'
	);
	echo (json_encode($out));	
	die();
}
print_r($_GET);
if (!$_GET['name'] || !$_GET['from'] || !$_GET['to']) {
	$out = array(
		'result'=>0,
		'error'=>'Invalid Request'
	);
	echo (json_encode($out));
	die();
}

$live->createEvent($_GET['name'],$_GET['from'],$_GET['to']);

$out = array(
	'result' => 1,
	'error' => null
);
echo (json_encode($out));
?>