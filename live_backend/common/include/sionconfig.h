/*
sionconfig.h
#defines for networking stuff
and paths and everything else, really
*/
#ifndef SIONCONFIG
#define SIONCONFIG

/* 
Sion -> Ciel telemetry 
Sion <- Ciel telemetry (eg tracker reset command)
*/
#define SIONOUTHOST "192.168.0.20"
#define SIONOUTPORT "3490"
#define CIELIN_SION_HOST "192.168.0.10"
#define CIELIN_SION_PORT "3491"

/*
Sion <- Ciel sync request
Sion -> Ciel sync reply
*/
#define CIELOUT_SYNC_HOST CIELIN_SION_HOST
#define CIELOUT_SYNC_PORT "3492"
#define SIONIN_SYNC_HOST SIONOUTHOST
#define SIONIN_SYNC_PORT "3493"

/*
Seven -> Ciel control car telemetry
*/
#define SEVENOUTHOST "127.0.0.1"
#define SEVENOUTPORT "3494"
#define CIELIN_SEVEN_HOST "127.0.0.1"
#define CIELIN_SEVEN_PORT "3495"

/* Ciel -> open socket to scanalysis or whatever is the latest monitoring soft */
#define CIELOUT_OPEN_HOST "127.0.0.1"
#define CIELOUT_OPEN_PORT "3496"
#define TELEM_TARGET_HOST "127.0.0.1"
#define TELEM_TARGET_PORT "31337"

/* Same as above but with multicast; last I checked multicast is broken on python, so...*/
/* Currently not implemented */
#define MULTICASTSOURCE1 "127.0.0.1"
#define MULTICASTSOURCE2 "192.168.0.10"
#define MULTICASTGROUP "239.0.0.157"
#define MULTICASTPORT "31337" /* ELIIIIITE */
#define MULTICASTTTL 2

/*
Path to the canlog dir, where all sqlite databases
will be stored, relative to the executable
sion_sender and ciel_receiver
*/
#define CANLOG_DIR "../canlog"

/*
Maximum number of packets to sync in one go
*/
#define MAXSYNCLISTSIZE 1000

#endif
