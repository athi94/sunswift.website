/*
* Project: SION (Sunswift IV Observer Node)
* File name: sqlitedriver.h
* Author: Irving Tjiptowarsono
* Description:
* SQLite3 driver for SION - header files
* 
* 
* 
* 
* Copyright (C) 2011 NICTA (www.nicta.com.au)
* 
*/

#ifndef __SQLITE_DEFINED__
#define __SQLITE_DEFINED__

#include <stdint.h>
#include "scandal.h"

/* Maximum length of individual SQL query.
*/
#define MAX_SQL_QUERY_LENGTH 300

/* Length of sqlite BEGIN....COMMIT block.
*/
#define SQLITE_BLOCKLEN 200

/* Connects to a database file and returns the connection object.
 * If database file is nonexistent, a new db file will be created.
 * Also sets up various parameters for sqlite3 if necessary.
 * If you pass NEWDB, it will attempt to create new tables 
 * but will fail if database already exists.
 */
#define NEWDB 1
#define OLDDB 0
int init_sqlite3(sqlite3 **db, char *dbpath, int createdb);

/* Sends a string query to sqlite3.
 * db is database connection object
 * query is the query string
 * returns ????
 */
int query_sqlite3(sqlite3 *db, char *query);

/*
 * Stores a single scandal packet into the database
 */
int insert_can_packet(sqlite3 *db, sion_entry *entry);


/* Queues can packet in a sqlite BEGIN...COMMIT block.
 * The length of the block is defined by block_length
 * When the amount of queued packet reaches length, 
 * the transaction will automatically be comitted.
 */
int queue_can_packet(sqlite3 *db, sion_entry *entry, int block_length);

/* Flushes the write buffer and closes connection
 */
void shutdown_sqlite3(sqlite3 *db);


/* Fetches a single sion entry from the database,
 * based on their packet ID.
 * Returns 0 on success, -1 on failure.
 */
int fetch_sion_entry(sqlite3 *db, sion_entry *entry, uint32_t pkt_id);


/* Generate filename for a database file, based on time of day.
 * Filename is an empty string buffer which it will insert file path in
 * accuracy is how detailed you want the filename would be:
 * giving it ACCURACY_DAY will give you day only filename,
 * while giving it ACCURACY_SECOND will make a filename detailing time 
 * until the last second.
 * Use the former for both.
 * The latter was implemented before I changed my mind.
*/
#define ACCURACY_SECOND	1
//#define ACCURACY_MINUTE	2 //not implemented
//#define ACCURACY_HOUR	3 //not implemented
#define ACCURACY_DAY	4
//#define ACCURACY_MONTH	5 //not implemented
//#define ACCURACY_YEAR	6 //not implemented
void makedbfile(char *filename, int accuracy);

/* Checks if the database file already exist or not.
 * returns 1 if file exists, 0 otherwise.
*/
#define FILE_EXISTS 1
#define NO_FILE_EXISTS 0
int checkdbfile(char* filename);

//int callback(void *NotUsed, int argc, char **argv, char **azColName);
//int query_sqlite3_with_callback(sqlite3 *db, char *query,  int (*callback_function)(void*,int,char**,char**), void * callback_arg1);

int get_largest_pkt_id(sqlite3 *db);
int get_smallest_pkt_id(sqlite3 *db);

int get_number_of_packet_between(sqlite3 *db, uint32_t pkt_id_new, uint32_t pkt_id_old, uint32_t *number_of_packets);
int get_list_of_missing_packets_between(sqlite3 *db, uint32_t pkt_id_new, uint32_t pkt_id_old, uint32_t list_of_missing_packets[]);




#endif
