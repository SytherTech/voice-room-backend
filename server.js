const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const players = {}; // Store player information including peer IDs and usernames
let roomPlayers = []; // Store list of players in the room

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a player joins a room
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);
        players[socket.id] = { username, socketId: socket.id };
        roomPlayers.push(socket.id);

        console.log(`${username} joined room ${roomId}`);

        // Notify other players in the room
        socket.to(roomId).emit('newPeer', { peerId: socket.id });

        // Send the list of current players in the room
        io.to(roomId).emit('playersInRoom', roomPlayers);
    });

    // Handle offer from initiator to other player
    socket.on('offer', ({ peerId, sdp }) => {
        console.log(`Received offer from ${socket.id} to ${peerId}`);
        // Emit offer with type
        io.to(peerId).emit('offer', { peerId: socket.id, sdp, type: 'offer' });
    });

    // Handle answer from the other player
    socket.on('answer', ({ peerId, sdp }) => {
        console.log(`Received answer from ${socket.id} to ${peerId}`);
        // Emit answer with type
        io.to(peerId).emit('answer', { peerId: socket.id, sdp, type: 'answer' });
    });

    // Handle ICE candidates
    socket.on('iceCandidate', ({ peerId, candidate }) => {
        io.to(peerId).emit('iceCandidate', { peerId: socket.id, candidate });
    });

    // Start the game when the 'startGame' event is received
    socket.on('startGame', ({ roomId }) => {
        console.log(`Starting game in room: ${roomId}`);

        // Notify all players in the room that the game is starting
        io.to(roomId).emit('gameStarted', { message: 'The game has started!' });

        // Optionally, you can reset or initialize any game state here
    });

    // When a player disconnects, clean up
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        roomPlayers = roomPlayers.filter(playerId => playerId !== socket.id);

        // Notify the room about the disconnection
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
