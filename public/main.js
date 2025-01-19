const socket = io();
const roomId = document.getElementById('roomId').innerText;

let localStream;
const peerConnections = {};
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ],
};

// Request microphone access and join the room
async function joinRoom() {
    const userName = prompt('Enter your name:');
    if (!userName) return;

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

        socket.on('offer', async ({ sdp, fromSocketId }) => {
            const peerConnection = createPeerConnection(fromSocketId);

            try {
                // Ensure the peer connection is not in the wrong state
                if (peerConnection.signalingState === 'stable') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);

                    socket.emit('answer', {
                        sdp: peerConnection.localDescription,
                        targetSocketId: fromSocketId,
                    });
                } else {
                    console.log('Peer connection is not in a stable state yet');
                }
            } catch (error) {
                console.error('Error while handling offer:', error);
            }
        });

        // Handle receiving an answer
        socket.on('answer', async ({ sdp, fromSocketId }) => {
            const peerConnection = peerConnections[fromSocketId];
            if (peerConnection && peerConnection.signalingState !== 'stable') {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                } catch (error) {
                    console.error('Error while setting remote description for answer:', error);
                }
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
