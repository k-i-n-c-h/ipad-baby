const websocket = new WebSocket('ws://192.168.1.21:8765');

websocket.onopen = function() {
    console.log('WebSocket connection established.');
};

websocket.onerror = function(error) {
    console.error('WebSocket error:', error);
};

websocket.onmessage = function(event) {
    console.log('Message from server:', event.data);
};

// Event listener for play button
document.getElementById('playButton').addEventListener('click', function() {
    const frequency = parseInt(document.getElementById('frequency').value);
    const lfoShape = document.getElementById('lfoShape').value;
    const lfoFrequency = 2.0;  // Example LFO frequency (can be adjusted)

    const message = {
        type: 'play_signal_oscillator',
        frequency: frequency,
        lfo_frequency: lfoFrequency,
        lfo_shape: lfoShape
    };

    websocket.send(JSON.stringify(message));
});

// Event listener for stop button
document.getElementById('stopButton').addEventListener('click', function() {
    const message = {
        type: 'stop_audio'
    };

    websocket.send(JSON.stringify(message));
});
