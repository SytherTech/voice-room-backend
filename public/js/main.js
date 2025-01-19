const socket = io();
const roomId = document.getElementById('roomId')?.innerText || '';  // Make sure this element exists

let localStream;
const peerConnections = {};
const config = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302',
        },
    ],
};

// Request microphone access and join the room
async function joinRoom() {
    const userName = prompt('Enter your name:');
    if (!userName || !roomId) return;

    // Capture local audio stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        addLocalAudio();

        socket.emit('join_room', { roomId, name: userName });

        // Handle existing participants
        socket.on('existing_participants', (participants) => {
            participants.forEach((participant) => createOffer(participant.socketId));
        });

        // Handle a new participant joining
        socket.on('user_joined', (participant) => {
            createOffer(participant.socketId);
        });

        // Handle receiving an offer
        socket.on('offer', async ({ sdp, fromSocketId }) => {
            const peerConnection = createPeerConnection(fromSocketId);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit('answer', {
                sdp: peerConnection.localDescription,
                targetSocketId: fromSocketId,
            });
        });

        // Handle receiving an answer
        socket.on('answer', async ({ sdp, fromSocketId }) => {
            const peerConnection = peerConnections[fromSocketId];
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            }
        });

        // Handle receiving ICE candidates
        socket.on('ice_candidate', ({ candidate, fromSocketId }) => {
            const peerConnection = peerConnections[fromSocketId];
            if (peerConnection) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        // Handle a participant leaving
        socket.on('user_left', ({ socketId }) => {
            const audioElement = document.getElementById(socketId);
            if (audioElement) audioElement.remove();

            const peerConnection = peerConnections[socketId];
            if (peerConnection) {
                peerConnection.close();
                delete peerConnections[socketId];
            }
        });
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
}

// Create a new RTCPeerConnection
function createPeerConnection(socketId) {
    const peerConnection = new RTCPeerConnection(config);

    // Add local audio stream to the connection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle receiving remote audio stream
    peerConnection.ontrack = (event) => {
        const audioElement = document.createElement('audio');
        audioElement.id = socketId;
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        document.body.appendChild(audioElement);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            socket.emit('ice_candidate', { candidate, targetSocketId: socketId });
        }
    };

    peerConnections[socketId] = peerConnection;
    return peerConnection;
}

// Create an offer for a new participant
async function createOffer(socketId) {
    const peerConnection = createPeerConnection(socketId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', {
        sdp: peerConnection.localDescription,
        targetSocketId: socketId,
    });
}

// Add local audio to the UI
function addLocalAudio() {
    const audioElement = document.createElement('audio');
    audioElement.srcObject = localStream;
    audioElement.autoplay = true;
    audioElement.muted = true; // Mute local audio playback
    audioElement.id = 'localAudio'; // Assign an id to local audio
    document.body.appendChild(audioElement);
}

// Initialize the app
joinRoom();
