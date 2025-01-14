// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {}; // Stores room data

// Serve static files (if needed, for frontend integration)
app.use(express.static('public'));

// When a client connects
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Create a new game room
    socket.on('createRoom', (data) => {
        const { roomId, username } = data;
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                gameStarted: false,
                rolesAssigned: false,
                votes: {},
            };
        }
        rooms[roomId].players.push({ username, socketId: socket.id });
        console.log(`Room created: ${roomId} by ${username}`);
        socket.join(roomId);
        io.to(roomId).emit('newPeer', { roomId, username });
    });

    // Join an existing room
    socket.on('joinRoom', (data) => {
        const { roomId, username } = data;
        if (rooms[roomId] && rooms[roomId].gameStarted === false) {
            rooms[roomId].players.push({ username, socketId: socket.id });
            console.log(`${username} joined room: ${roomId}`);
            socket.join(roomId);
            io.to(roomId).emit('newPeer', { roomId, username });
        } else {
            socket.emit('error', 'This room is either full or the game has already started.');
        }
    });

    // Start the game
    socket.on('startGame', (data) => {
        const { roomId } = data;
        if (rooms[roomId] && !rooms[roomId].gameStarted) {
            rooms[roomId].gameStarted = true;
            assignRoles(roomId);
            io.to(roomId).emit('startGame', { message: 'Game started, roles assigned!' });
        }
    });

    // Assign roles
    const assignRoles = (roomId) => {
        const room = rooms[roomId];
        const spyIndex = Math.floor(Math.random() * room.players.length);
        room.players.forEach((player, index) => {
            const role = index === spyIndex ? 'Spy' : 'Innocent';
            io.to(player.socketId).emit('rolesAssigned', { role });
            player.role = role; // Save role for future use
        });
        room.rolesAssigned = true;
    };

    // Player votes for the spy
    socket.on('vote', (data) => {
        const { roomId, votedPlayerId } = data;
        if (rooms[roomId]) {
            rooms[roomId].votes[votedPlayerId] = (rooms[roomId].votes[votedPlayerId] || 0) + 1;
            console.log(`Vote casted for player ${votedPlayerId} in room ${roomId}`);
        }
    });

    // End the game
    socket.on('endGame', (data) => {
        const { roomId, winner } = data;
        if (rooms[roomId]) {
            const room = rooms[roomId];
            room.gameStarted = false;
            io.to(roomId).emit('endGame', { winner });
            console.log(`Game ended in room ${roomId}. Winner: ${winner}`);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        for (let roomId in rooms) {
            const room = rooms[roomId];
            room.players = room.players.filter(player => player.socketId !== socket.id);
            if (room.players.length === 0) {
                delete rooms[roomId]; // Delete empty room
            } else {
                io.to(roomId).emit('newPeer', { message: 'A player has left the room.' });
            }
        }
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
