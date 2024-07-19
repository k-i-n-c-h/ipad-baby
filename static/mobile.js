let ws;
let activeTouchId = null;  // Track the active touch ID

function connectWebSocket() {
    ws = new WebSocket("ws://10.42.0.1:8765");  // Adjust IP address as needed

    ws.onopen = function() {
        console.log("WebSocket connected");
    };

    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        console.log("Received message from server:", message);
        if (message.type === "debug_info") {
            updateDebugInfo(message.data);
        } else if (message.type === "active_sounds") {
            updateActiveSounds(message.data);
        }
    };

    ws.onclose = function() {
        console.log("WebSocket closed");
        sendStopSignalAll();
    };

    ws.onerror = function(event) {
        console.error("WebSocket error:", event);
    };
}

function mapFrequencyToColor(frequency) {
    let hue = frequency * 360;
    return `hsl(${hue}, 100%, 50%)`;
}

function sendStartSignal(frequency, lfoFrequency, lfoShape, pan) {
    const message = {
        type: "play_signal_oscillator",
        frequency: frequency,
        lfo_frequency: lfoFrequency,
        lfo_shape: lfoShape,
        pan: pan
    };

    const color = mapFrequencyToColor(frequency);
    const colorBox = document.getElementById('colorBox');
    if (colorBox) {
        colorBox.style.backgroundColor = color;
        colorBox.textContent = `${frequency.toFixed(2)} Hz`;
    }

    ws.send(JSON.stringify(message));
}

function sendStopSignal() {
    const message = {
        type: "stop_audio"
    };
    ws.send(JSON.stringify(message));
}

function sendStopSignalAll() {
    const message = {
        type: "stop_all_audio"
    };
    ws.send(JSON.stringify(message));
}

function getActiveSounds() {
    const message = {
        type: "get_all_playing_sounds"
    };
    ws.send(JSON.stringify(message));
}

function updateActiveSounds(activeSounds) {
    const soundMarkersContainer = document.getElementById('soundMarkers');
    soundMarkersContainer.innerHTML = '';

    activeSounds.forEach(sound => {
        const marker = document.createElement('div');
        marker.className = 'sound-marker';
        marker.style.backgroundColor = mapFrequencyToColor(sound.frequency);
        const yPos = mapRange(sound.frequency, 400, 30, 0, window.innerHeight);
        const xPos = mapRange(sound.lfo_frequency, -200, 200, 0, window.innerWidth);
        marker.style.left = `${xPos}px`;
        marker.style.top = `${yPos}px`;
        soundMarkersContainer.appendChild(marker);
    });
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

document.addEventListener("DOMContentLoaded", function() {
    connectWebSocket();

    document.body.addEventListener("touchstart", function(event) {
        event.preventDefault();
        
        if (activeTouchId !== null) {
            return;
        }

        const touch = event.changedTouches[0];
        const frequency = mapRange(touch.clientY, window.innerHeight, 0, 30, 600);
        const lfoFrequency = mapRange(touch.clientX, 0, window.innerWidth, -200, 200);
        const pan = mapRange(touch.clientX, 0, window.innerWidth, 0, 1);  // Map x-coordinate to pan value
        
        activeTouchId = touch.identifier;

        sendStartSignal(frequency, lfoFrequency, 'sine', pan);
    });

    document.body.addEventListener("touchend", function(event) {
        event.preventDefault();

        if (activeTouchId === null || event.changedTouches.length !== 1) {
            return;
        }

        sendStopSignal();
        activeTouchId = null;

        const colorBox = document.getElementById('colorBox');
        if (colorBox) {
            colorBox.style.backgroundColor = "#000000";
            colorBox.textContent = "";
        }
    });

    setInterval(getActiveSounds, 150);  // Fetch every 300ms
});
