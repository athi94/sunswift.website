<?php

require_once("config.inc.php");
require_once("Class.Parser.php");
require_once("Class.Live.php");


$live = new Live($config);
echo $live->getJSON();
$live->cleanUp();
?>