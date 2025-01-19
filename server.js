const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection (optional, for storing rooms/users)
mongoose
    .connect('mongodb+srv://abdullah_bconsulting:bEotRMwlEmxiWqpw@b-consltuing.ufwab.mongodb.net/realestate', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Routes
app.get('/', (req, res) => {
    res.render('index', { roomId: '', userName: '' });
});

app.get('/room/:roomId', (req, res) => {
    const { roomId } = req.params;
    res.render('index', { roomId, userName: '' });
});

// WebSocket events
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('join_room', async ({ roomId, name }) => {
        console.log(`${name} joined room ${roomId}`);
        socket.join(roomId);
        socket.to(roomId).emit('user_joined', { socketId: socket.id, name });

        // Send existing participants
        io.to(roomId).emit('existing_participants', Array.from(io.sockets.adapter.rooms.get(roomId)).map(id => ({ socketId: id })));
    });

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

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        io.emit('user_left', { socketId: socket.id });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
