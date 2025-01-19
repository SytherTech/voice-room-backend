const socket = io();

const roomId = document.getElementById('roomId').innerText;
const participantsDiv = document.getElementById('participants');
const muteToggle = document.getElementById('muteToggle');
const leaveButton = document.getElementById('leave');

let isMuted = false;

// Join the room
socket.emit('join_room', { roomId, name: prompt('Enter your name:') });

// Handle existing participants
socket.on('existing_participants', (participants) => {
    participants.forEach(addParticipant);
});

// Handle a new participant joining
socket.on('user_joined', (participant) => {
    addParticipant(participant);
});

// Handle a participant leaving
socket.on('user_left', ({ socketId }) => {
    const participantDiv = document.getElementById(socketId);
    if (participantDiv) participantDiv.remove();
});

// Mute/unmute logic
muteToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    muteToggle.innerText = isMuted ? 'Unmute' : 'Mute';
});

// Leave room
leaveButton.addEventListener('click', () => {
    socket.disconnect();
    window.location.href = '/';
});

// Helper to add a participant to the UI
function addParticipant(participant) {
    const div = document.createElement('div');
    div.id = participant.socketId;
    div.innerText = participant.name;
    participantsDiv.appendChild(div);
}
