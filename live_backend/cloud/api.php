<?php
require_once("config.inc.php");
require_once("Class.Parser.php");
require_once("Class.Live.php");

$live = new Live($config);

if (empty($_GET['do'])) {
	$live->throwError();
}

switch ($_GET['do']) {
	case 'closestupdate':	
		if (empty($_GET['time'])) $live->throwError();
		else echo $live->getClosestData($_GET['time']/1000);
	break;
	case 'lastbatch':
		if (empty($_GET['time'])) $live->throwError();
		else echo $live->getLastBatch($_GET['time']/1000);
	break;
	case 'time':
		$date = date_create();
		echo json_encode(array("time"=>date_timestamp_get($date)*1000));
	break;
	case 'lastupdate':
		echo $live->getOldestData();
	break;
	default:
		$live->throwError();
	break;
}

$live->cleanUp();
?>