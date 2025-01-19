const express = require('express');
const app = express();
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// MongoDB connection
mongoose
    .connect('mongodb+srv://abdullah_bconsulting:bEotRMwlEmxiWqpw@b-consltuing.ufwab.mongodb.net/voicecha', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Mongoose Room Schema
const Room = mongoose.model('Room', {
    roomId: String,
    participants: [
        {
            socketId: String,
            name: String,
        },
    ],
});

// Socket.IO event handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Handle user joining a room
    socket.on('join_room', async ({ roomId, name }) => {
        try {
            let room = await Room.findOne({ roomId });
            if (!room) {
                room = new Room({ roomId, participants: [] });
            }

            // Prevent duplicate participants
            if (room.participants.some((p) => p.socketId === socket.id)) {
                socket.emit('error', 'User already in the room');
                return;
            }

            const newParticipant = { socketId: socket.id, name };
            room.participants.push(newParticipant);
            await room.save();

            socket.join(roomId);

            // Notify the new participant about existing participants
            const existingParticipants = room.participants.filter(
                (p) => p.socketId !== socket.id
            );
            socket.emit('existing_participants', existingParticipants);

            // Notify others in the room about the new participant
            socket.to(roomId).emit('user_joined', newParticipant);

            console.log(`User ${name} joined room ${roomId}`);
        } catch (error) {
            console.error('Error in join_room:', error);
        }
    });

    // Handle WebRTC signaling (offer, answer, ICE candidates)
    socket.on('offer', (data) => {
        io.to(data.targetSocketId).emit('offer', {
            sdp: data.sdp,
            fromSocketId: socket.id,
        });
    });

    socket.on('answer', (data) => {
        io.to(data.targetSocketId).emit('answer', {
            sdp: data.sdp,
            fromSocketId: socket.id,
        });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.targetSocketId).emit('ice_candidate', {
            candidate: data.candidate,
            fromSocketId: socket.id,
        });
    });

    // Handle user disconnection
    socket.on('disconnect', async () => {
        try {
            const room = await Room.findOne({ 'participants.socketId': socket.id });
            if (room) {
                // Remove the participant
                room.participants = room.participants.filter(
                    (p) => p.socketId !== socket.id
                );
                await room.save();

                // Notify others in the room about the disconnection
                io.to(room.roomId).emit('user_left', { socketId: socket.id });
                console.log(`User ${socket.id} disconnected from room ${room.roomId}`);
            }
        } catch (error) {
            console.error('Error in disconnect:', error);
        }
    });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
