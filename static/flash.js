import * as THREE from 'three';

let ws;
let scene, camera, renderer;
let soundMarker;
const torusRadius = 2;
const ringRadius = 5;
let movingLight;
const moveSpeed = 0.05;
const rotateSpeed = 0.01;
const keys = {};
let soundMarkers = [];  // Array to store active sound markers

function connectWebSocket() {
    ws = new WebSocket("ws://192.168.1.21:8765");  // Adjust IP address as needed

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

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    movingLight = new THREE.PointLight(0xffffff, 1, 50);
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
    // Clear existing sound markers
    soundMarkers.forEach(marker => {
        scene.remove(marker);  // Remove from scene
    });
    soundMarkers = [];  // Clear the array

    // Create new sound markers based on active sounds
    activeSounds.forEach(sound => {
        let marker = createSoundMarker(sound.frequency);
        soundMarkers.push(marker);
        scene.add(marker);
    });
}

function createSoundMarker(frequency) {
    // Define the shader material for raymarching
    const soundMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            frequency: { value: frequency }  // Pass frequency to shader
        },
        vertexShader: `
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            uniform float frequency;  // Frequency data from active sounds

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                float aspectRatio = resolution.x / resolution.y;

                // Example raymarching function (replace with your own)
                float distance = length(uv - 0.5) * 2.0 * sin(time * frequency); // Deform based on frequency

                // Example color based on distance
                vec3 color = vec3(1.0 - distance); // Example color function

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    // Create a plane geometry to use with the shader material
    const geometry = new THREE.PlaneGeometry(10, 10, 32, 32);
    const marker = new THREE.Mesh(geometry, soundMaterial);

    // Position the marker in the scene
    marker.position.set(0, 0, 0);  // Adjust position as needed

    return marker;
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

    // Update moving light source position
    movingLight.position.x = Math.sin(Date.now() * 0.001) * 10;
    movingLight.position.z = Math.cos(Date.now() * 0.001) * 10;

    // Update shader uniforms (time and frequency)
    soundMarkers.forEach(marker => {
        if (marker.material instanceof THREE.ShaderMaterial) {
            marker.material.uniforms.time.value += 0.01;
            // You can update other uniforms here if needed
        }
    });

    renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", function() {
    init();
    setInterval(getActiveSounds, 100);  // Uncomment if needed
});

function getActiveSounds() {
    const message = {
        type: "get_all_playing_sounds"
    };
    ws.send(JSON.stringify(message));
}
