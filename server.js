const express = require('express');
const app = express();
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/voicechat', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.log('MongoDB connection error:', error);
});

const Room = mongoose.model('Room', {
    roomId: String,
    participants: [{
        socketId: String,
        name: String,
        position: Number
    }]
});

io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId, name }) => {
        try {
            let room = await Room.findOne({ roomId });
            if (!room) {
                room = new Room({ roomId, participants: [] });
            }

            const position = room.participants.length;
            const newParticipant = { socketId: socket.id, name, position };

            room.participants.push(newParticipant);
            await room.save();

            socket.join(roomId);

            const existingParticipants = room.participants.filter(p => p.socketId !== socket.id);
            socket.emit('existing_participants', existingParticipants);

            socket.to(roomId).emit('user_joined', newParticipant);

            console.log(`User ${name} joined room ${roomId} at position ${position}`);
        } catch (error) {
            console.error('Error in join_room:', error);
        }
    });

    socket.on('offer', async (data) => {
        console.log(`offer Data : ${data.sdp}`)
        io.to(data.targetSocketId).emit('offer', {
            sdp: data.sdp,
            fromSocketId: socket.id
        });
    });

    socket.on('answer', async (data) => {
        console.log(`answer Data : ${data}`)
        io.to(data.targetSocketId).emit('answer', {
            sdp: data.sdp,
            fromSocketId: socket.id
        });
    });

    socket.on('ice_candidate', (data) => {
        console.log(`Ice Data : ${data}`)
        io.to(data.targetSocketId).emit('ice_candidate', {
            candidate: data.candidate,
            fromSocketId: socket.id
        });
    });

    socket.on('disconnect', async () => {
        const room = await Room.findOne({ 'participants.socketId': socket.id });
        if (room) {
            room.participants = room.participants.filter(p => p.socketId !== socket.id);
            await room.save();
            io.to(room.roomId).emit('user_left', { socketId: socket.id });
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
