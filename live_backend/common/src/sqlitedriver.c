/*
* Project: SION (Sunswift IV Observer Node)
* File name: sqlitedriver.c
* Author: Irving Tjiptowarsono
* Description: 
* Interface code to SQLite3 database
* 
* 
* 
* 
* Copyright (C) 2011 NICTA (www.nicta.com.au)
* 
*/
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h> //exit()
#include <sys/time.h> //gettimeofday
#include <time.h> //transforming time
#include <unistd.h> //access() to check files

#include "sionconfig.h" //for db file path
#include "sqlite3.h"
#include "sqlitedriver.h"


int init_sqlite3(sqlite3 **db, char *dbpath, int createdb) {
	int dbconn;
	/* Opens a database connection */
	dbconn = sqlite3_open(dbpath, db);
	if( dbconn ){
		fprintf(stderr, "Can't open database: %s\n", sqlite3_errmsg(*db));
		sqlite3_close(*db);
		return -1;
	}
	
	/* If database is new, set up tables and stuff. */
	if (createdb == NEWDB) {
		/* Packet number is INTEGER UNIQUE to prevent duplicates. This is handled during INSERT, below.*/
		// HACK FIXME: disabled UNIQUE to accomodate the nonexsistent onboard logging 
		if (query_sqlite3(*db, "CREATE TABLE canlog ("
								"packet_number INTEGER, "
								"priority INTEGER, message_type INTEGER, "
								"source_address INTEGER, "
								"specifics INTEGER, "
								"value INTEGER, "
								"scandal_timestamp INTEGER, "
								"ciel_timestamp INTEGER );")
			 != 0) {
			printf("Database creation fails! Quitting!\n");
			exit(1);
		}
	}
	
	/* disable atomic commit. 
	 * do not use unless you have to and you know what you are doing.
	 * should not be needed ever, as atomic commit is one reason I used SQLITE.
	 */ 
	//query_sqlite3(*db, "PRAGMA synchronous = OFF;");
	
	
	return 0;
}

int query_sqlite3(sqlite3 *db, char *query) {
	int rc;
	char * sqlerrmsg = 0;
	rc = sqlite3_exec(db, query, NULL, NULL, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in querying code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}
	return 0;
}

int insert_can_packet(sqlite3 *db, sion_entry *entry) {
	char query[MAX_SQL_QUERY_LENGTH];
	/* Insert row into database */
	memset(query, 0, sizeof(query));
	/*INSERT OR IGNORE basically aborts the insert query if a violation occurs - in this case, we don't want duplicates in pkt_id, so the column is UNIQUE and any duplicates will cause a violation.*/
	sprintf(query, "INSERT OR IGNORE INTO canlog VALUES (%u, %u, %u, %u, %u, %d, %llu, %llu );", entry->pkt_id, entry->priority, entry->message_type, entry->source_address, entry->specifics, entry->value, entry->scandal_timestamp, entry->ciel_timestamp );
	query_sqlite3(db, query);
	
	return 0;
}

int queue_can_packet(sqlite3 *db, sion_entry *entry, int block_length) {
	static int block_size=0;
	if (block_size == 0) {
		query_sqlite3(db, "BEGIN TRANSACTION;");
	}
	
	insert_can_packet(db, entry);
	block_size++;
	
	if (block_size >= block_length) {
		query_sqlite3(db, "COMMIT TRANSACTION;");
		block_size=0;
	}
	
	return 0;
}

void shutdown_sqlite3(sqlite3 *db) {
	query_sqlite3(db, "COMMIT TRANSACTION");
	sqlite3_close(db);
}


void makedbfile(char *filename, int accuracy) {
	struct timeval tstamp;
	struct tm utctime;
	
	gettimeofday(&tstamp, NULL); //get unix time
	gmtime_r(&tstamp.tv_sec, &utctime); //convert to utc
	
	if (ACCURACY_SECOND == accuracy ) {
		sprintf( filename,
				  "%s/%04d-%02d-%02d_%02d:%02d:%02d_canlog.sqlite", 
				  CANLOG_DIR,
				  utctime.tm_year+1900,
				  utctime.tm_mon+1,
				  utctime.tm_mday,
				  utctime.tm_hour,
				  utctime.tm_min,
				  utctime.tm_sec
				);//turn into text string
	}
	else if (ACCURACY_DAY == accuracy ) {
		sprintf( filename,
				  "%s/%04d-%02d-%02d_canlog.sqlite", 
				  CANLOG_DIR,
				  utctime.tm_year+1900,
				  utctime.tm_mon+1,
				  utctime.tm_mday
				);//turn into text string
	}
}

/* Check whether the database file exists or not.*/
int checkdbfile(char* filename ) {

	if (access(filename, F_OK))
		return NO_FILE_EXISTS;
	else
		return FILE_EXISTS;
}


/* From here on, its queries used during the sync process. AKA magical stuff. */

int get_largest_pkt_id_callback(void *largest_pkt_id, int argc, char **argv, char **azColName) {
//	for (i = 0; i<argc; i++) {
//		printf("%s = %s\n", azColName[i], argv[i] ? argv[i] : "NULL");
//	}
//	printf("\n");
	if (argv[0] != NULL) {
		sscanf(argv[0], "%u", (uint32_t* )largest_pkt_id);
	}
	else {
		*((uint32_t*) largest_pkt_id) = 0;
	}
	return 0;
}

int get_largest_pkt_id(sqlite3 *db) {
	int rc;
	uint32_t largest_pkt_id=0;
	char * sqlerrmsg = 0;
	rc = sqlite3_exec(db, "SELECT MAX(packet_number) FROM canlog;", get_largest_pkt_id_callback, &largest_pkt_id, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in getting largest pkt_id code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}
		return largest_pkt_id;
}
/* should be merged together with the above since they're identical */
int get_smallest_pkt_id_callback(void *largest_pkt_id, int argc, char **argv, char **azColName) {
//	for (i = 0; i<argc; i++) {
//		printf("%s = %s\n", azColName[i], argv[i] ? argv[i] : "NULL");
//	}
//	printf("\n");
	if (argv[0] != NULL) {
		sscanf(argv[0], "%u", (uint32_t* )largest_pkt_id);
	}
	else {
		*((uint32_t*) largest_pkt_id) = 0;
	}
	return 0;
}

int get_smallest_pkt_id(sqlite3 *db) {
	int rc;
	uint32_t largest_pkt_id=0;
	char * sqlerrmsg = 0;
	rc = sqlite3_exec(db, "SELECT MIN(packet_number) FROM canlog;", get_largest_pkt_id_callback, &largest_pkt_id, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in getting largest pkt_id code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}
		return largest_pkt_id;
}
int fetch_sion_entry_callback(void *entry, int argc, char **argv, char **azColName) {
/*
	int i;
	for (i = 0; i<argc; i++) {
		printf("%s = %s\n", azColName[i], argv[i] ? argv[i] : "NULL");
	}
	printf("\n");
*/
	sscanf(argv[0], "%u", &((sion_entry*)entry)->pkt_id);
	sscanf(argv[1], "%hhu", &((sion_entry*)entry)->priority);
	sscanf(argv[2], "%hhu", &((sion_entry*)entry)->message_type);
	sscanf(argv[3], "%hhu", &((sion_entry*)entry)->source_address);
	sscanf(argv[4], "%hu", &((sion_entry*)entry)->specifics);
	sscanf(argv[5], "%d", &((sion_entry*)entry)->value);
	sscanf(argv[6], "%Lu", &((sion_entry*)entry)->scandal_timestamp);
	sscanf(argv[7], "%Lu", &((sion_entry*)entry)->ciel_timestamp);

	return 0;
}

int fetch_sion_entry (sqlite3 *db, sion_entry *entry, uint32_t pkt_id) {
	int rc;
	char * sqlerrmsg = 0;
	char query[MAX_SQL_QUERY_LENGTH];
	sprintf(query,  "SELECT * FROM canlog WHERE packet_number == %u;", pkt_id );
	rc = sqlite3_exec(db, query, fetch_sion_entry_callback, entry, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in fetching sion_entry code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}
	return 0;
}

int packet_count_callback(void *number_of_packets, int argc, char **argv, char **azColName) {
	if (argv[0] != NULL) {
		sscanf(argv[0], "%u", (uint32_t* )number_of_packets);
	}
	else {
		*((uint32_t*) number_of_packets) = 0;
	}

return 0;
}

/*
pkt_id_new is not counted, but pkt_id_old is.
This makes the result match a simple new - old subtraction for a complete database.
*/

int get_number_of_packet_between(sqlite3 *db, uint32_t pkt_id_new, uint32_t pkt_id_old, uint32_t *number_of_packets) {
	int rc;
	char * sqlerrmsg = 0;
	char query[MAX_SQL_QUERY_LENGTH];
	sprintf(query,  "SELECT COUNT(*) FROM canlog WHERE packet_number >= %u AND packet_number < %u;", pkt_id_old, pkt_id_new );
	rc = sqlite3_exec(db, query, packet_count_callback, number_of_packets, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in getting number of packet code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}
return 0;
}

/* This is called for each row of results! so we need a way to keep track of the next free indices in the array.
static variables cant be reset by itself, global is jusy ugly
so we keep track using the first indices of the array
*/
int missing_packet_list_callback (void *list_of_packets, int argc, char **argv, char **azColName) {
	uint32_t *array = ((uint32_t *)list_of_packets);
	array[0]++; //location of next free indices
	sscanf(argv[0], "%u", &(array[array[0]]) );
return 0;
}

int get_list_of_missing_packets_between(sqlite3 *db, uint32_t pkt_id_new, uint32_t pkt_id_old, uint32_t list_of_missing_packets[]) {
	int rc;
	char * sqlerrmsg = 0;
	char query[MAX_SQL_QUERY_LENGTH];
	uint32_t list_of_packets[MAXSYNCLISTSIZE];
	uint32_t count, id_count, missing_count;
	list_of_packets[0]=0; //first indice is the number of indices currently stored in the array

	/* get the big list of EXISTING packet numbers */
	sprintf(query,  "SELECT packet_number FROM canlog WHERE packet_number >= %u AND packet_number < %u ORDER BY packet_number;", pkt_id_old, pkt_id_new );
	rc = sqlite3_exec(db, query, missing_packet_list_callback, list_of_packets, &sqlerrmsg);
	if( rc!=SQLITE_OK ){
		fprintf(stderr, "SQL error in getting list of existing packet code %d: %s\n", rc, sqlerrmsg);
		sqlite3_free(sqlerrmsg);
		return -1;
	}

	/* find the gap in them */
	missing_count = 0;
	count = 1;
	id_count = pkt_id_old;
	printf("%u, %u, %u, %u;\n", id_count, pkt_id_new, count,  list_of_packets[count]);

	int i;
	for (i = 0; i < 10; i++) {
		printf("%u\n", list_of_packets[i]);
	}

	while ( id_count < pkt_id_new ) {
		if (list_of_packets[count] == id_count) { //if packet found
			//do nothing, all's right with the world
			//printf("Packet exists:%u\n", id_count);
			id_count++; //check next row
			count++; //against next expected packet number
		}
		else if (list_of_packets[count] > id_count) {//if packet number suddenly jump ahead...
			/* DING DONG, we have a missing packet! */
			printf("Current packet, missing packet: %u, %u\n",list_of_packets[count], id_count);
			list_of_missing_packets[missing_count] = id_count; //record Id of missing packet
			missing_count++;
			id_count++; //check if next packet id is also missing
		}
		else if (list_of_packets[count] < id_count) { //if count gets ahead of the existing packet
			//All packets from now until pkt_id_new is missing
			list_of_missing_packets[missing_count] = id_count; //record Id of missing packet
			printf("Missing packet until limit: %u, %u\n",list_of_packets[count], id_count);
			missing_count++;
			id_count++; //keep on recording....
			break;
		}
	}

return 0;
}
