/*
circbuffer.h
circular buffer header file

*/
#include <cmsis/LPC17xx.h>
#include <project/sion_can.h>
#include "scandal.h"



//typedef for parameters of the buffer
typedef struct circbuf {
uint16_t start; //start at array location 0.
uint16_t length; //initially there's no data.
} circbuf;

//example of buffer global variables.
//do not uncomment
//can_pkt inbuf[CAN_IN_BUFFER_SIZE], outbuf[CAN_OUT_BUFFER_SIZE];
//circbuf incount, outcount;

extern uint32_t dropped_packet_count;
extern uint32_t received_packet_count;


//function declarations

uint8_t remove_packet(can_pkt *pkt, can_pkt *buf, circbuf *count, uint16_t size);

uint8_t insert_packet(can_pkt *pkt, can_pkt *buf, circbuf *count, uint16_t size);
