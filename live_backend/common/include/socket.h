/*
* Project: SION (Sunswift IV Observer Node)
* File name: socket.h
* Author: Irving Tjiptowarsono
* Description:
* Header file for socket comms
* 
* 
* 
* Copyright (C) 2011 NICTA (www.nicta.com.au)
* 
*/

#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <fcntl.h>
#include <stdio.h>
#include <sys/poll.h>

#include "scandal.h"

//magic number from the PLEB - 100 , works, so I'm using it. Also below the MTU of ethernet & wifi
#define SOCKET_BUFFER_SIZE 1400

//number of CAN packets to group before calling sendto()
//too small and wifi will lag, too large and delay will grow
//should use automatic rate calculation if there's time
#define SOCKET_BLOCK_LENGTH 5
#define MAX_SOCKET_BLOCK_LENGTH (30 * SCANDALLONGSTRINGSIZE) //approx 630 bytes


int socket_init(int *sockfd, struct addrinfo **remoteinfo,
	char *local_host, char* local_port,
	char *remote_host, char* remote_port) ;

int socket_send(int *sockfd, void *data, int msglength, struct addrinfo *remoteinfo);
int socket_recv(int *sockfd, void *data, int maxlength);


//queue should be declared as an array with MAX_SENDTO_BLOCK_LENGTH as size.
int queue_socket_send(int *sockfd, void *data, int msglength, struct addrinfo *remoteinfo,
	 char *queue, int block_length);

int socket_readable(int *sockfd);

/* oold definitions, kept for comparison so far.
int socket_init(char *local_host, int local_port,
                char *remote_host, int remote_port);
int socket_send(void *data, size_t length);
int socket_recv(void *data, size_t length);
int socket_writeable(void);	
*/
