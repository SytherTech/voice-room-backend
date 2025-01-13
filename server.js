const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (update for production)
        methods: ["GET", "POST"],
    },
});

const rooms = {}; // Store room details with user info

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Join Room
    socket.on("joinRoom", ({ roomId, username }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = []; // Initialize room if it doesn't exist
        }

        // Add user to the room
        rooms[roomId].push({ id: socket.id, username });
        socket.join(roomId);

        // Notify others in the room
        io.to(roomId).emit("userJoined", { username, users: rooms[roomId] });
        console.log(`User ${username} joined room ${roomId}`);
    });

    // Handle Messages
    socket.on("sendMessage", ({ roomId, message }) => {
        const user = rooms[roomId]?.find((u) => u.id === socket.id);
        if (user) {
            io.to(roomId).emit("receiveMessage", {
                username: user.username,
                message,
            });
            console.log(`Message from ${user.username} in room ${roomId}: ${message}`);
        }
    });

    // Handle Voice Stream
    socket.on("voiceStream", ({ roomId, audioData }) => {
        console.log(audioData)
        socket.to(roomId).emit("voiceStream", { id: socket.id, audioData });
    });

    // Handle Disconnect
    socket.on("disconnect", () => {
        for (const roomId in rooms) {
            const userIndex = rooms[roomId].findIndex((u) => u.id === socket.id);
            if (userIndex !== -1) {
                const [user] = rooms[roomId].splice(userIndex, 1);
                io.to(roomId).emit("userLeft", { username: user.username, users: rooms[roomId] });
                console.log(`User ${user.username} left room ${roomId}`);
                if (rooms[roomId].length === 0) {
                    delete rooms[roomId]; // Delete room if empty
                }
                break;
            }
        }
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
