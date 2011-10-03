/*
circbuffer.c
circular buffer main file

Abandon all hope, ye who enter here.
*/
#include "circbuffer.h"
#include "scandal.h"

uint32_t dropped_packet_count;
uint32_t received_packet_count;

/* Remove packet from tail of the buffer */
uint8_t remove_packet(can_pkt *pkt, can_pkt *buf, circbuf *count, uint16_t size) {
	//if buffer is empty, fail
	if (count->length <= 0)
		return 1;
/*
	uint16_t location;
	location = count->start + count->length; //locate the spot
	if (location > (size-1)) { //trying to reach over the end of array, wrap back to the beginning
		location = location - size;
	}
*/
	pkt->id = buf[count->start].id;
	pkt->payload = buf[count->start].payload;

	//mark space as unused
	count->length--;
	count->start++;
	if (count->start > (size-1)) //trying to reach over end of array, wrap back
		count->start = count->start - size;

	return 0;
}

/* Insert packet into head of buffer */
uint8_t insert_packet(can_pkt *pkt, can_pkt *buf, circbuf *count, uint16_t size) {
	if (count->length == size) {//if buffer is full, delete oldest data
		can_pkt dummypacket;
		remove_packet( &dummypacket, buf, count, size);
		dropped_packet_count++;
	}

	uint16_t location;
	count->length++; //otherwise, let's allocate one spot
	location = count->start + count->length - 1; //locate the spot
	if (location > (size-1)) { //trying to reach over the end of array, wrap back to the beginning
		location = location - size;
	}
	buf[location].id = pkt->id;
	buf[location].payload = pkt->payload;
	received_packet_count++;
	return 0;
}

