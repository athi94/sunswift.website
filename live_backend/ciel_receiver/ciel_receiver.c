/*
* Project: SION (Sunswift IV Observer Node)
* File name: ciel_receiver.c
* Author: Irving Tjiptowarsono
* Description: Control car interface to SION
* 
* 
* 
* 
* 
* Copyright (C) 2011 NICTA (www.nicta.com.au)
* 
*/

#include <stdio.h>
#include <string.h>
#include <stdint.h> //for exact definitions of variable lengths
#include <stdlib.h> //exit()
#include <signal.h>
#include <sys/time.h> //gettimeofday
#include <pthread.h> //multithreading
#include <math.h> 
#include <sys/types.h> //select()
#include <unistd.h> //select(), sync()

#include "sqlite3.h"
#include "sionconfig.h"
#include "scandal.h"
#include "sqlitedriver.h"
#include "socket.h"

#define MAX_LINE_LENGTH 50


volatile sig_atomic_t loop = 1;


/*
Very hacky way of handling signal.
(according to the GNU guide anyway; 
I'm supposed to set a flag, return to main loop and execute
whatever I need.)
*/

sqlite3 *db, *dbsync;

void shutdown_cleanly(int signum) {
	loop = 0;
	printf("CIEL: Receiving signal %d, shutting down...\n", signum);
	//signal(SIGINT, shutdown_cleanly);
	shutdown_sqlite3(db);
	sqlite3_close(dbsync);
	exit(1);
}

int sockfd_sion, sockfd_seven, sockfd_telemout, sockfd_sync, sockfd_telemout2;
struct addrinfo *sioninfo, *telemoutinfo, *seveninfo, *syncinfo, *telemoutinfo2;

/* Output thread, for ciel -> sion data */
/* This will give GCC warning since it expects an argument of datatype void * data, but we dont have that so its OK.*/
//TODO: Make so this warning goes away.
void * output_thread (void) {
	printf("CIEL: Output thread started....\n");
	sion_entry testentry; //DEBUG
	uint8_t ostring[SCANDALSTRINGSIZE];
	printf("CIEL: Done initialising output thread, entering main loop...\n");
	while(1) {
		if (socket_readable(&sockfd_telemout) == 0) {//if there is data...
			socket_recv(&sockfd_telemout, ostring, SCANDALSTRINGSIZE); //grab it
			socket_send(&sockfd_sion, ostring, SCANDALSTRINGSIZE, sioninfo); //and pass it to SION
		}
	}
	pthread_exit(NULL);
}


/* Thread to handle sync process */
void * sync_thread (void) {
/*
This section is full of magic, so if you're the next person who work in this stuff
feel free to contact me or write your own implementation - irving
*/
	printf("CIEL: Sync thread started...\n");

	uint8_t cstring[CONTROLSTRINGSIZE];
	uint32_t pkt_id_new, pkt_id_old, number_of_stored_packets;
	uint32_t number_of_missing_packets, counter;
	uint32_t list_of_missing_packets[MAXSYNCLISTSIZE];
	control_packet ctrl_pkt;


	pkt_id_old = get_smallest_pkt_id(dbsync); //start of database
	pkt_id_new = get_largest_pkt_id(dbsync);

	while (pkt_id_new <=1 ){ //if database is new/empty, do not try to sync anything
		sleep(10);
		pkt_id_new = get_largest_pkt_id(dbsync);
	}
	
	//if it's not new...
	if (pkt_id_new >= (pkt_id_old + MAXSYNCLISTSIZE )) {
				/* We don't want to fetch a list later on that is larger than what we can store */
				pkt_id_new = pkt_id_old + MAXSYNCLISTSIZE -1; //dont know if -1 is needed but just to be safe.
	}

	while (1) {
		/* Then, we check if there's any missing packets. */
		get_number_of_packet_between(dbsync, pkt_id_new, pkt_id_old, &number_of_stored_packets);
		number_of_missing_packets = (pkt_id_new - pkt_id_old) - number_of_stored_packets; //pkt_id_new is not included in the number of stored packet.
		if (number_of_missing_packets > 0) {
			/* If yes, try to sync them */
			/* Get the list of missing pkt IDs, up until a max limit */
			get_list_of_missing_packets_between(dbsync, pkt_id_new, pkt_id_old, list_of_missing_packets); 
			for(counter = 1 ; counter <= number_of_missing_packets; counter++ ) {
				/*send a request for each one*/
				ctrl_pkt.type = CAN_PACKET_RETRANSMISSION_REQUEST;
				ctrl_pkt.value = list_of_missing_packets[counter];
				controltostring(&ctrl_pkt, cstring);
				socket_send(&sockfd_sync, cstring, CONTROLSTRINGSIZE, syncinfo);
			}
			/* When done, we loop again just to make sure (since this thread can't confirm that all the packets has been received)*/
		}
		else {
			/* We're fully synchronised up until this point, so let's move on*/
			pkt_id_old = pkt_id_new;
			pkt_id_new = get_largest_pkt_id(dbsync);
			if (pkt_id_old == pkt_id_new) {
				/* No new data have come in the meantime... maybe we're in control stop? Let's sleep for now.*/
				sleep(10);
			}
			else if (pkt_id_new >= (pkt_id_old + MAXSYNCLISTSIZE )) {
				/* We don't want to fetch a list later on that is larger than what we can store */
				pkt_id_new = pkt_id_old + MAXSYNCLISTSIZE -1; //dont know if -1 is needed but just to be safe.
			}
		}
	}
	pthread_exit(NULL);
}


/* main loop */
int main (void) {
	uint8_t string[SCANDALLONGSTRINGSIZE];
	/* can packet parameters */
	sion_entry entry;
	char dbfilename[MAX_LINE_LENGTH];
	struct timeval tstamp;

	/* set up signals */
	signal(SIGINT, shutdown_cleanly);
	signal(SIGINT, shutdown_cleanly);
	
	/* set up sqlite db */
	makedbfile(dbfilename, ACCURACY_DAY);
	FILE *textlog = fopen("../canlog/scandal.log", "a");


	if (checkdbfile(dbfilename)){
		init_sqlite3(&db, dbfilename, OLDDB);
		init_sqlite3(&dbsync, dbfilename, OLDDB);
		printf("CIEL: opening previous database....\n");
	}
	else {
		init_sqlite3(&db, dbfilename, NEWDB);
		init_sqlite3(&dbsync, dbfilename, OLDDB);
		printf("CIEL: creating new database...\n");
	}

	/* Set up sockets */
	int numbytes;
	int loopcounter;
	char receivequeue[MAX_SOCKET_BLOCK_LENGTH];

	//select() stuff
	fd_set master;
	fd_set read_fds;
	int fdmax;
	int fdcount;
	FD_ZERO(&master);
	FD_ZERO(&read_fds);

	//socket for receiving SION data
	socket_init(&sockfd_sion, &sioninfo,
				CIELIN_SION_HOST, CIELIN_SION_PORT, SIONOUTHOST, SIONOUTPORT) ;
	//socket for sending sync requests and receiving their reply
	socket_init(&sockfd_sync, &syncinfo,
				CIELOUT_SYNC_HOST, CIELOUT_SYNC_PORT, SIONIN_SYNC_HOST, SIONIN_SYNC_PORT);
	//socket for receiving Seven data.
	socket_init(&sockfd_seven, &seveninfo, 
				CIELIN_SEVEN_HOST, CIELIN_SEVEN_PORT, SEVENOUTHOST, SEVENOUTPORT);
	//socket for sending these to something else.
	socket_init(&sockfd_telemout, &telemoutinfo,
				CIELOUT_OPEN_HOST, CIELOUT_OPEN_PORT, TELEM_TARGET_HOST , TELEM_TARGET_PORT) ;
	//socket for sending these to something else.
	//socket_init(&sockfd_telemout2, &telemoutinfo2,
	//			CIELOUT_OPEN_HOST2, CIELOUT_OPEN_PORT2, TELEM_TARGET_HOST2 , TELEM_TARGET_PORT2) ;


	//more select() stuff
	FD_SET(sockfd_sion, &master);
	FD_SET(sockfd_seven, &master);
	FD_SET(sockfd_sync, &master);
	fdmax = sockfd_sync;
	if (fdmax < sockfd_seven) //checking to make sure fdmax is the largest
		fdmax = sockfd_seven;
	if (fdmax < sockfd_sion)
		fdmax = sockfd_sion;
	fdmax++; //+1 as required by select()

	/* Set up threads */

	printf("CIEL: Setting up threads...\n ");
	pthread_t out_thread,  sync_thread_handler;
	int rc;
	rc = pthread_create(&out_thread, NULL, output_thread, NULL);
	if (rc) {
		printf("CIEL: ERROR: Return code from pthread_create for output thread is %d\n", rc);
		exit(-1);
	}
	/*
	rc = pthread_create(&sync_thread_handler, NULL, sync_thread, NULL);
	if (rc) {
		printf("CIEL: ERROR: Return code from pthread_create for sync thread is %d\n", rc);
		exit(-1);
	}
	*/


	//FIXME 
	/*
	int date_is_set=0;
	int number_of_seconds_since_epoch = 0;
	int delay = 0;
	*/

	printf("CIEL: Entering main receiver loop..\n");
	while ( loop ) {
		read_fds = master;
		if (select(fdmax, &read_fds, NULL, NULL, NULL) == -1) {
			perror("select");
			exit(4);
		}

		for(fdcount = 0; fdcount <=fdmax; fdcount++ ) { //for all the socket descriptors....
			if(FD_ISSET(fdcount, &read_fds)) {
				if (fdcount == sockfd_sion ) {
					/* Receiving live telemetry stream */
					numbytes = socket_recv(&sockfd_sion, receivequeue, 
						SCANDALLONGSTRINGSIZE * SOCKET_BLOCK_LENGTH);
					gettimeofday(&tstamp, NULL); //hurry, grab the timestamp!
				}
				else if (fdcount == sockfd_seven) {
					/* Receiving live control car stream */
					numbytes = socket_recv(&sockfd_seven, receivequeue,
						SCANDALLONGSTRINGSIZE * SOCKET_BLOCK_LENGTH);
					gettimeofday(&tstamp, NULL); //hurry, grab the timestamp!
				}
				else if (fdcount == sockfd_sync) {
					/* Receiving solar car retransmission */
					numbytes = socket_recv(&sockfd_sync, receivequeue, 
						SCANDALLONGSTRINGSIZE * SOCKET_BLOCK_LENGTH);
					gettimeofday(&tstamp, NULL); //hurry, grab the timestamp!
				}
			}
		}

		/*
		Since each ethernet packet contains multiple CAN packets, we unpack them
		one by one and process them individually.
		*/
		for (loopcounter=0; loopcounter < SOCKET_BLOCK_LENGTH; loopcounter++) {
			//extract an individual packet
			memmove(string, &receivequeue[(SCANDALLONGSTRINGSIZE*loopcounter)], SCANDALLONGSTRINGSIZE);

			//TODO: Fix the Scandal Channel messages etc timestamps to full 64-bit.

			socket_send(&sockfd_telemout, string, SCANDALSTRINGSIZE, telemoutinfo); //to scanalysis
			//socket_send(&sockfd_telemout2, string, SCANDALSTRINGSIZE, telemoutinfo2); //to sunswift live
			
			longstringtoentry(string, &entry);
			entry.ciel_timestamp = (((uint64_t) tstamp.tv_sec) * 1000) +
				( (uint64_t) lrintf( ((float) tstamp.tv_usec) / 1000 ) ); 
			//FIXME: delay log
			//if(entry.source_address == 30 && entry.specifics == 6) {
			//date_is_set = entry.value;
			//printf("Today is %d days since epoch.\n\r", date_is_set);
			//}	

			//FIXME: Delay log.
			//if (date_is_set && entry.source_address == 30 && entry.specifics == 5 ) {
			//number_of_seconds_since_epoch = date_is_set * 24 * 3600;
			// Calculate # of seconds today
			//delay = tstamp.tv_sec -  (entry.value / 1000 + number_of_seconds_since_epoch);
			//printf("Delay is %d seconds\n\r", delay);
			//fprintf(delaylog, "%llu %ld\n\r", entry.scandal_timestamp, tstamp.tv_sec);
			//sync();
			//}

			//FIXME: plaintext log, not needed
			
			fprintf(textlog,"%d\t%d\t%d\t%d\t%d\t%llu\t%llu\t%u\n\r", 
			entry.priority, 
			entry.message_type, 
			entry.source_address, 
			entry.specifics, 
			entry.value,
			entry.scandal_timestamp,
			entry.ciel_timestamp,
			entry.pkt_id);
			

			queue_can_packet(db, &entry, SQLITE_BLOCKLEN); //duplicate packets are ignored by sqlite

			/* Debug function. Do not print too much UART or you'll slow everything down. */
			#define SION_DEBUG
			#ifdef SION_DEBUG
				printf_sion_entry(&entry);
				//printf("%llu\t%u\n\r", entry.scandal_timestamp, entry.pkt_id); 
			#endif
		} //end processing individual packets
	}// end infinite loop
	
	shutdown_sqlite3(db);//why is this even here
	return 0; //makes compiler happy
}

