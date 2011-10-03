/*
* Project: SION (Sunswift IV Observer Node)
* File name: scandal.h
* Author: Irving Tjiptowarsono
* Description: 
* Macros and functions to manipulate scandal CAN packets
* These are type-agnostic, so it works on all packet types
* even though the packets may look like gibberish without the proper
* scandal macros to interpret them (user errors, for example...)
* 
* Copyright (C) 2011 NICTA (www.nicta.com.au)
* 
*/
#ifndef __SCANDAL_DEFINED__
#define __SCANDAL_DEFINED__

/* SION as a CAN node itself */
#define SION_SCANDAL_ADDRESS 52
#define THIS_DEVICE_TYPE 35 //SION type in scandal_devices.h

/* out channels */
#define SION_DROPPED_PACKET_COUNT 0
#define SION_RECEIVED_PACKET_COUNT 1
#define SION_NUM_OUT_CHANNELS 2

/* information about can packet types */
#define THIS_IS_AN_EXTENDED_HEADER_MESSAGE (1<<31)
#define SCANDALSTRINGSIZE	13
#define SCANDALLONGSTRINGSIZE 21
#define CONTROLSTRINGSIZE 5

/* Packet headers and control messages */
#define CAN_MESSAGE_HEADER 'U'
#define START_SENDING_CAN_MESSAGES 'S'
#define CAN_PACKET_RETRANSMISSION_REQUEST 0x01
#define SHUTDOWN_SIGNAL 'D'

/* information about id structure */
#define PRI_OFFSET 26
#define PRI_BITS 3
#define TYPE_OFFSET 18
#define TYPE_BITS 8
#define ADDR_BIT_OFFSET 10
#define ADDR_BIT_MASK 8
#define SPECIFICS_BIT_OFFSET 0
#define SPECIFICS_BIT_MASK 10
#define VALUE_OFFSET 32
#define VALUE_MASK 0x00000000FFFFFFFF
#define TIMESTAMP_OFFSET 0
#define TIMESTAMP_MASK 0x00000000FFFFFFFF

/* Scandal priorities, copied verbatim from scandal_messages.h */
#define TELEM_HIGH 3
#define TELEM_LOW 7

/* macros to decode scandal packets */
#define BYTE(x,y)       (((x)>>((y)<<3)) & 0xFF)
#define GET_PRIORITY(pkt)				((pkt->id >> PRI_OFFSET) & ((1<<PRI_BITS)-1))
#define GET_MESSAGE_TYPE(pkt)			((pkt->id >> TYPE_OFFSET) & ((1<<TYPE_BITS)-1))
#define GET_SOURCE_ADDRESS(pkt)			((pkt->id >> ADDR_BIT_OFFSET) & ((1<<ADDR_BIT_MASK)-1))
#define GET_SPECIFICS(pkt)				((pkt->id >> SPECIFICS_BIT_OFFSET) & ((1<<SPECIFICS_BIT_MASK)-1))
#define GET_VALUE(pkt)					((int32_t)((pkt->payload >> VALUE_OFFSET) & VALUE_MASK))
#define GET_SCANDAL_TIMESTAMP(pkt)		((uint64_t)((pkt->payload >> TIMESTAMP_OFFSET) & TIMESTAMP_MASK))


/* CAN packet structure */
typedef struct can_packet{
	uint32_t id; //MSB of this element is the header length. 0 for standard, 1 for extended.
	uint64_t payload;
}can_pkt;

/* Database entry structure */
typedef struct sion_database_entry{
	uint8_t priority;
	uint8_t message_type;
	uint8_t source_address;
	uint16_t specifics;
	int32_t value;
	uint64_t scandal_timestamp;
	uint64_t ciel_timestamp;
	uint32_t pkt_id;
}sion_entry;

/* Sync control packet structure */
typedef struct control_packet_structure {
	uint8_t type;
	uint32_t value;
}control_packet;

extern uint32_t timestamp_offset;


/* convert between structures */
static inline void cantoentry(can_pkt *pkt, sion_entry *entry) {
	//these macros also masks everything unneccesary, so the header length bit is discarded.
	entry->priority = GET_PRIORITY(pkt); 
	entry->message_type = GET_MESSAGE_TYPE(pkt);
	entry->source_address = GET_SOURCE_ADDRESS(pkt);
	entry->specifics = GET_SPECIFICS(pkt);
	entry->value = GET_VALUE(pkt);
	entry->scandal_timestamp = GET_SCANDAL_TIMESTAMP(pkt);
}

static inline void entrytocan(sion_entry *entry, can_pkt *pkt){
	pkt->id = 	((uint32_t)entry->priority << PRI_OFFSET) |
				((uint32_t)entry->message_type << TYPE_OFFSET) |
				((uint32_t)entry->source_address << ADDR_BIT_OFFSET) |
				((uint32_t)entry->specifics << SPECIFICS_BIT_OFFSET) ;
	pkt->payload = ((uint64_t) (entry->value) << 32) | entry->scandal_timestamp;
}

static inline void entrytostring(sion_entry *entry, uint8_t *string) {
	
	string[0] = entry->priority;
	string[1] = entry->message_type;
	string[2] = entry->source_address;
	string[3] = BYTE(entry->specifics, 0);
	string[4] = BYTE(entry->specifics, 1);

	string[5] = BYTE((uint32_t)entry->value, 0);
	string[6] = BYTE((uint32_t)entry->value, 1);
	string[7] = BYTE((uint32_t)entry->value, 2);
	string[8] = BYTE((uint32_t)entry->value, 3);
	
	string[9]  = BYTE(entry->scandal_timestamp, 0);
	string[10] = BYTE(entry->scandal_timestamp, 1);
	string[11] = BYTE(entry->scandal_timestamp, 2);
	string[12] = BYTE(entry->scandal_timestamp, 3);
	
}

static inline void stringtoentry(uint8_t *string, sion_entry *entry) {
		entry->priority = string[0];
		entry->message_type = string[1];
		entry->source_address = string[2];
		entry->specifics = 	 (uint16_t) string[3] | 
							((uint16_t) string[4] << 8);
		entry->value = 	 (int32_t) string[5] 		|
						((int32_t) string[6] << 8 )	|
						((int32_t) string[7] << 16)	|
						((int32_t) string[8] << 24)	;
		entry->scandal_timestamp = 	 (uint64_t) string[9 ] 		|
									((uint64_t) string[10] << 8 )|
									((uint64_t) string[11] << 16)|
									((uint64_t) string[12] << 24);
}

/*
long string transfers extra info that is not contaied in a can packet.

the full 64 bit scandal timstamp is transferred, this gives the flexibility of reconstructing the timestamp 
on either sion or ciel.

ciel_timestamp on the other hand, is not transferred since sion has nothing to do with it.*

pkt_id is transferred for obvious reasons.*

*NOTE: scandal_timestamp is actually generated from system time in case of ciel_seven data. There's no pkt_id for this.

if confused, as Irving, I'm in a hurry.

*/
static inline void entrytolongstring(sion_entry *entry, uint8_t *longstring) {
	longstring[0] = entry->priority;
	longstring[1] = entry->message_type;
	longstring[2] = entry->source_address;
	longstring[3] = BYTE(entry->specifics, 0);
	longstring[4] = BYTE(entry->specifics, 1);

	longstring[5] = BYTE((uint32_t)entry->value, 0);
	longstring[6] = BYTE((uint32_t)entry->value, 1);
	longstring[7] = BYTE((uint32_t)entry->value, 2);
	longstring[8] = BYTE((uint32_t)entry->value, 3);
	
	longstring[9]  = BYTE(entry->scandal_timestamp, 0);
	longstring[10] = BYTE(entry->scandal_timestamp, 1);
	longstring[11] = BYTE(entry->scandal_timestamp, 2);
	longstring[12] = BYTE(entry->scandal_timestamp, 3);
	longstring[13] = BYTE(entry->scandal_timestamp, 4);
	longstring[14] = BYTE(entry->scandal_timestamp, 5);
	longstring[15] = BYTE(entry->scandal_timestamp, 6);
	longstring[16] = BYTE(entry->scandal_timestamp, 7);

	longstring[17] = BYTE(entry->pkt_id, 0);
	longstring[18] = BYTE(entry->pkt_id, 1);
	longstring[19] = BYTE(entry->pkt_id, 2);
	longstring[20] = BYTE(entry->pkt_id, 3);

}

static inline void longstringtoentry(uint8_t *longstring, sion_entry *entry) {
	entry->priority = longstring[0];
	entry->message_type = longstring[1];
	entry->source_address = longstring[2];
	entry->specifics = 	 (uint16_t) longstring[3] | 
						((uint16_t) longstring[4] << 8);
	entry->value = 	 (int32_t) longstring[5] 		|
					((int32_t) longstring[6] << 8 )	|
					((int32_t) longstring[7] << 16)	|
					((int32_t) longstring[8] << 24)	;
	entry->scandal_timestamp = 	 (uint64_t) longstring[9 ] 		|
								((uint64_t) longstring[10] << 8 )|
								((uint64_t) longstring[11] << 16)|
								((uint64_t) longstring[12] << 24)|
								((uint64_t) longstring[13] << 32)|
								((uint64_t) longstring[14] << 40)|
								((uint64_t) longstring[15] << 48)|
								((uint64_t) longstring[16] << 56);
	entry->pkt_id =				 (uint64_t) longstring[17] 		|
								((uint64_t) longstring[18] << 8 )|
								((uint64_t) longstring[19] << 16)|
								((uint64_t) longstring[20] << 24);

}

static inline void controltostring(control_packet *ctrl_pkt, uint8_t *cstring) {
	cstring[0] = ctrl_pkt->type;
	cstring[1] = BYTE(ctrl_pkt->value, 0);
	cstring[2] = BYTE(ctrl_pkt->value, 1);
	cstring[3] = BYTE(ctrl_pkt->value, 2);
	cstring[4] = BYTE(ctrl_pkt->value, 3);
}

static inline void stringtocontrol(uint8_t *cstring, control_packet *ctrl_pkt) {
	ctrl_pkt->type = cstring[0];
	ctrl_pkt->value= (uint32_t) cstring[1] 			|
					((uint32_t) cstring[2] << 8 )	|
					((uint32_t) cstring[3] << 16)	|
					((uint32_t) cstring[4] << 24)	;
}

/* Craft a scandal packet for SION */
static inline void make_entry_from_SION(sion_entry *entry, uint16_t channel_number, int32_t value, uint32_t timestamp) {
entry->priority = 0x07; //lowest by default
entry->message_type = 0x00; //channel message
entry->source_address = SION_SCANDAL_ADDRESS;
entry->specifics = channel_number;
entry->value = value;
entry->scandal_timestamp = timestamp;
}


//if compiled for lpc1768, do not include this since it does not have c std lib
#ifndef __SION_CAN_HEADER__
static inline void printf_sion_entry (sion_entry *entry) {
printf("%d\t%d\t%d\t%d\t%d\t%llu\t%llu\t%u\n\r", 
		entry->priority, 
		entry->message_type, 
		entry->source_address, 
		entry->specifics, 
		entry->value,
		entry->scandal_timestamp,
		entry->ciel_timestamp,
		entry->pkt_id);
}
#endif

#endif

	
	
