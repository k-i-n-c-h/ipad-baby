import * as THREE from 'three';

let ws;
let scene, camera, renderer;
let soundMarkers = [];
const maxSoundMarkers = 100;
const moveSpeed = 0.05;  // Slower move speed
const rotateSpeed = 0.01;  // Slower rotate speed
const keys = {};
const torusRadius = 2;
const markerRotationSpeed = 0.02;  // Slower rotation speed
const ringRadius = 5;  // Radius of the ring for markers to follow
let movingLight;

function connectWebSocket() {
    ws = new WebSocket("ws://192.168.1.19:8765");  // Adjust IP address as needed

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
    };

    ws.onerror = function(event) {
        console.error("WebSocket error:", event);
    };
}

function updateDebugInfo(data) {
    const debugInfoDiv = document.getElementById('debugInfo');
    debugInfoDiv.textContent = JSON.stringify(data, null, 2);
}

function mapFrequencyToColor(frequency) {
    let hue = (frequency - 30) / (200 - 30) * 360;  // Normalize frequency to range [0, 360]
    return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
}

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);  // Adjusted near and far values
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;  // Enable shadows
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Directional light for shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    directionalLight.castShadow = true;  // Enable shadow casting
    scene.add(directionalLight);

    // Moving light source
    movingLight = new THREE.PointLight(0xffffff, 1, 50);  // Adjust parameters as needed
    scene.add(movingLight);

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

    connectWebSocket();
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    keys[event.code] = true;
}

function onKeyUp(event) {
    keys[event.code] = false;
}

function updateActiveSounds(activeSounds) {
    // Update existing markers
    soundMarkers.forEach(marker => {
        if (activeSounds.some(sound => sound.frequency === marker.userData.frequency)) {
            marker.userData.age = 0;  // Reset age for active markers
        } else {
            if (marker.material.opacity > 0) {
                marker.material.opacity -= 0.2 * (1 / 60); // Fade out over 5 seconds (assuming 60 FPS)
            } else {
                scene.remove(marker);
                soundMarkers.splice(soundMarkers.indexOf(marker), 1);
            }
        }
    });

    activeSounds.forEach((sound, index) => {
        if (soundMarkers.length < maxSoundMarkers) {
            let geometry = new THREE.PlaneGeometry(mapRange(sound.frequency, 30, 200, 0.1, 1), mapRange(sound.frequency, 30, 200, 0.1, 1));

            // Material with shadows
            let material = new THREE.MeshPhongMaterial({
                color: mapFrequencyToColor(sound.frequency),
                shininess: 100,
                reflectivity: 1,
                side: THREE.DoubleSide,  // Ensure both sides of the plane are visible
                transparent: true,  // Enable transparency for fade-out effect
                opacity: 1  // Initial opacity
            });

            let plane = new THREE.Mesh(geometry, material);

            // Apply uneven surface by displacing vertices
            const positionAttribute = geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positionAttribute, i);
                vertex.x += (Math.random() - 0.5) * 0.02;
                vertex.y += (Math.random() - 0.5) * 0.02;
                vertex.z += (Math.random() - 0.5) * 0.02;
                positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
            positionAttribute.needsUpdate = true;

            // Calculate position on the torus
            const angleStep = (Math.PI * 2) / maxSoundMarkers;
            const toroidalAngle = angleStep * index; // Evenly spaced angle
            const torusX = (torusRadius + ringRadius * Math.cos(toroidalAngle)) * Math.cos(0);  // Start at angle 0
            const torusY = ringRadius * Math.sin(toroidalAngle);
            const torusZ = (torusRadius + ringRadius * Math.cos(toroidalAngle)) * Math.sin(0);  // Start at angle 0

            plane.position.set(torusX, torusY, torusZ);

            // Store properties for animation
            plane.userData.frequency = sound.frequency;
            plane.userData.lfoFrequency = sound.lfo_frequency;
            plane.userData.torusAngle = toroidalAngle;
            plane.userData.angle = 0; // Initial angle for rotation
            plane.userData.age = 0;  // Initialize age

            soundMarkers.push(plane);
            scene.add(plane);
        }
    });

    // Update marker count in debug info
    updateDebugInfo({ activeMarkers: soundMarkers.length });
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function animate() {
    requestAnimationFrame(animate);

    // Move camera based on key input
    if (keys['KeyW']) {
        camera.position.z -= moveSpeed;
    }
    if (keys['KeyS']) {
        camera.position.z += moveSpeed;
    }
    if (keys['KeyA']) {
        camera.position.x -= moveSpeed;
    }
    if (keys['KeyD']) {
        camera.position.x += moveSpeed;
    }
    if (keys['ArrowUp']) {
        camera.rotation.x -= rotateSpeed;
    }
    if (keys['ArrowDown']) {
        camera.rotation.x += rotateSpeed;
    }
    if (keys['ArrowLeft']) {
        camera.rotation.y -= rotateSpeed;
    }
    if (keys['ArrowRight']) {
        camera.rotation.y += rotateSpeed;
    }

    // Update moving light source
    movingLight.position.x = Math.sin(Date.now() * 0.001) * 10;  // Example movement
    movingLight.position.z = Math.cos(Date.now() * 0.001) * 10;  // Example movement

    // Update markers
    soundMarkers.forEach(marker => {
        marker.userData.angle += 0.005; // Slower increment angle

        // Update rotation based on frequencies
        marker.rotation.x += markerRotationSpeed * (marker.userData.frequency / 100);
        marker.rotation.y += markerRotationSpeed * (marker.userData.lfoFrequency / 200);

        // Update position on the torus
        const torusX = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.cos(marker.userData.angle);
        const torusY = ringRadius * Math.sin(marker.userData.torusAngle);
        const torusZ = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.sin(marker.userData.angle);

        marker.position.set(torusX, torusY, torusZ);

        // Adjust size inversely proportional to frequency
        marker.scale.set(
            1 / mapRange(marker.userData.frequency, 30, 200, 0.1, 1),
            1 / mapRange(marker.userData.frequency, 30, 200, 0.1, 1),
            1
        );
    });

    renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", function() {
    init();
    setInterval(getActiveSounds, 100);  // Fetch every 100ms
});

function getActiveSounds() {
    const message = {
        type: "get_all_playing_sounds"
    };
    ws.send(JSON.stringify(message));
}
