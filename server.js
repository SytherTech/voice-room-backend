const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Home route to render the room creation page
app.get('/', (req, res) => {
    res.render('index');
});

// WebSocket connection for signaling
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // Join a specific room
    socket.on('join_room', (roomId, userName) => {
        socket.join(roomId);
        console.log(`${userName} joined room ${roomId}`);
        socket.to(roomId).emit('user_joined', userName);
    });

    // Send an offer to a user
    socket.on('offer', (data) => {
        socket.to(data.targetSocketId).emit('offer', {
            sdp: data.sdp,
            fromSocketId: socket.id,
        });
    });

    // Send an answer to a user
    socket.on('answer', (data) => {
        socket.to(data.targetSocketId).emit('answer', {
            sdp: data.sdp,
            fromSocketId: socket.id,
        });
    });

    // Send ICE candidate to a user
    socket.on('ice_candidate', (data) => {
        socket.to(data.targetSocketId).emit('ice_candidate', {
            candidate: data.candidate,
            fromSocketId: socket.id,
        });
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('a user disconnected', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
