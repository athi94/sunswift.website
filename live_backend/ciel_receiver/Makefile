PROJECT=ciel_receiver


COMMON=../common
INCLUDE=-I$(COMMON)/include
SOURCEDIR=$(COMMON)/src

CC=gcc
DEBUG=-g
OPTIMISATION=-O2
CFLAGS=-Wall -Wextra $(DEBUG) $(OPTIMISATION) $(INCLUDE)
LIBS=-ldl -lpthread -lm
LDFLAGS=$(LIBDIRS) $(LIBS)

BUILDDIR=.
OUTPUTDIR=../build

$(PROJECT): $(PROJECT).o sqlitedriver.o socket.o sqlite3.o
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS) 
	cp $@ $(OUTPUTDIR)
#parser: parser.o source_log.o sqlitedriver.o
#	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

#### sender: sender.o output.o input.o sample.o socket.o cancode.o serial.o scandal_timer.o

##sender: sender.o can.o ../canbridge2/heap.o ../canbridge2/input.o ../canbridge2/microuptime.o ../canbridge2/output.o ../canbridge2/packet.o ../canbridge2/socket.o
#	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)


##hello: helloworld.o
#	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
##canusb: canusb.o
#	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

#how to build ciel_receiver.o
$(PROJECT).o : $(PROJECT).c
	$(CC) -c $(CFLAGS) $< -o $@

#special instructions to build sqlite3 from amalgamation file
sqlite3.o : $(SOURCEDIR)/sqlite3.c
	$(CC) -c $^ 

#how to build .o files
%.o : $(SOURCEDIR)/%.c
	$(CC) -c $(CFLAGS) $< -o $@

clean:
	rm -f *.o *~
	rm -f $(PROJECT) $(OUTPUTDIR)/$(PROJECT)
