<?php
//error_reporting(E_ERROR | E_WARNING | E_PARSE);
Class Live 
{
	private $params;
	private $live;
	private $link;
	public $credentials = 'SOMETEXT';
	
	public function __construct($config_params) {
		$this->params = $config_params;
		self::initDB();
	}
	
	private function initDB() {
		$link = mysql_connect($this->params['host'], $this->params['user'], $this->params['pass']);
		if (!$link) self::throwError("Could not connect to database.\n");
		else {
			if (!mysql_select_db($this->params['database'], $link)) self::throwError("Could not use database.\n");
			else $this->link =& $link;
		}
	}
	
	public function cleanUp() {
		@mysql_close($this->link);
	}
	
	public function appendDB() {
		/*
		$table = $this->params['table'];
		$result = $this->queryDB ("SELECT * FROM $table ORDER BY id DESC LIMIT 1");
		$data = array_pop(parent::getData());
		if (mysql_num_rows($result) > 0) {
			$row = mysql_fetch_assoc($result);
			$i = 0;
			$recording = false;
			$insertMe = array();
			foreach ($data as $val) {
				if ($recording == true) $insertMe[$i++] = $val;
				elseif ($val->time'] == $row['timestamp']) {
					$recording = true;
					$insertMe[$i++] = $val;
				}
				else continue;
			}
   			if (count($insertMe) > 0) $this->insertData($insertMe);
		}
		else $this->insertData($data);	// This should only fire the first time we populate the database*/
		$data = parent::getData();
		$meta = array_pop($data);
		$this->insertData($data);
	}
	
	public function cleanTable() {
		@mysql_query("TRUNCATE TABLE log;", $this->link);
	}
	
	public function insertData ($newData) {
		
		$table = $this->params['table'];	
		//mysql_query("set global max_allowed_packet = 500 * 1024 * 1024");
		$query = "INSERT IGNORE INTO $table (`timestamp`, `speed`, `batterypower`, `arraypower`, `motorpower`, `motortemp`, `heatsinktemp`, `latitude`, `longitude`) VALUES ";
		//echo print_r($newData);
	
		
		foreach ($newData as $val) {
			//foreach ($val as $thing) $val[$thing] = mysql_real_escape_string($val[$thing]);
			$query .= "('".$val->timestamp."', '".$val->speed."', '".$val->batterypower."', '".$val->arraypower."', '".$val->motorpower."', '".$val->motortemp."', '".$val->heatsinktemp."', '".$val->latitude."', '".$val->longitude."'),";
		}	
		$query{strlen($query)-1} = ";";		
		$this->queryDB($query);
	}
	
	
	private function queryDB ($query) {
		if (!($result = mysql_query($query, $this->link))) self::throwError("Could not query:".mysql_error()."\n");	
		else return $result;	
	}
	
	private function getRows ($result) {
		while ($row = mysql_fetch_assoc($result)) {
			$out[] = $row;
		}
		return $out;
	}
	
	public function getJSON() {
		$table = $this->params['table'];
		$query = "SELECT * FROM $table WHERE speed BETWEEN 1 AND 95 AND timestamp>'1294351243.77' ORDER BY timestamp ASC";
		$result = $this->queryDB($query);
		if (mysql_num_rows($result)>0)	return json_encode($this->getRows($result));
		else return null;
	}
	
	public function getClosestData ($timestamp) {
		$table = $this->params['table'];
		$time = mysql_real_escape_string($timestamp);
		$query = "SELECT * FROM $table WHERE timestamp < $time AND speed BETWEEN 1 AND 95 ORDER BY timestamp ASC LIMIT 1";
		$result = $this->queryDB($query);
		if (mysql_num_rows($result)>0)	return json_encode($this->getRows($result));
		else return null;		
	}
	
	public function getLastBatch($since) {
		$table = $this->params['table'];
		$time = mysql_real_escape_string($since);
		$from = $time+60;
		$query = "SELECT * FROM $table WHERE timestamp >= $time ORDER BY timestamp ASC LIMIT 32";	
		$result = $this->queryDB($query);
		if (mysql_num_rows($result)>0)	return json_encode($this->getRows($result));
		else return null;
	}
	
	public function getOldestData() {
		$table = $this->params['table'];
		$query = "SELECT * FROM $table WHERE latitude<>0 AND longitude<>0 ORDER BY timestamp DESC LIMIT 1";
		$result = $this->queryDB($query);
		if (mysql_num_rows($result)>0)	return json_encode($this->getRows($result));
		else return null;
	}
	
	public function getClosestLatLng($timestamp) {
		$table = $this->params['table'];
		$query = "SELECT latitude,longitude,timestamp FROM $table WHERE timestamp < $timestamp ORDER BY timestamp DESC LIMIT 1";
		$result = $this->queryDB($query);
		if (mysql_num_rows($result)>0)	return json_encode($this->getRows($result));
		else return null;	
	}
	
	public function AppendDBWithPhotos($data) {
		$table = $this->params['table'];
			$sql = "UPDATE $table SET photo = '".mysql_real_escape_string($data['photo_name'])."' WHERE timestamp = '".mysql_real_escape_string($data['time'])."'";
			//echo $sql."\n";
			$result = $this->queryDB($sql);
	}
	
	public function throwError ($msg) {
		//header("Status: 400 Bad Request");
		die($msg);
	}
	
	public function createEvent($name, $from, $to) {
		$table = $this->params['eventtable'];
		$time = mysql_real_escape_string($since);
		$query = sprintf("INSERT INTO $table (title, timestamp_from, timestamp_to) VALUES ('%s',%s,%s)",
					mysql_real_escape_string($name),
					mysql_real_escape_string($from),
					mysql_real_escape_string($to)
				);
		$result = $this->queryDB($query);
	}
}
?>