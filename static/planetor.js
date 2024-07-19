import * as THREE from 'three';

let ws;
let scene, camera, renderer;
let soundMarkers = [];
const maxSoundMarkers = 100;
const moveSpeed = 0.05;
const rotateSpeed = 0.01;
const keys = {};
const torusRadius = 2;
const markerRotationSpeed = 0.02;
const ringRadius = 5;
const maxMarkerLifetime = 5; // Maximum lifetime of markers in seconds
let directionalLight;

// Position for spawning planes
const spawnPosition = new THREE.Vector3(0, ringRadius, torusRadius);

function connectWebSocket() {
    ws = new WebSocket("ws://192.168.1.21:8765");

    ws.onopen = function () {
        console.log("WebSocket connected");
    };

    ws.onmessage = function (event) {
        const message = JSON.parse(event.data);
        console.log("Received message from server:", message);
        if (message.type === "debug_info") {
            updateDebugInfo(message.data);
        } else if (message.type === "active_sounds") {
            updateActiveSounds(message.data);
        }
    };

    ws.onclose = function () {
        console.log("WebSocket closed");
    };

    ws.onerror = function (event) {
        console.error("WebSocket error:", event);
    };
}

function updateDebugInfo(data) {
    const debugInfoDiv = document.getElementById('debugInfo');
    debugInfoDiv.textContent = JSON.stringify(data, null, 2);
}

function mapFrequencyToColor(frequency) {
    let hue = (frequency - 30) / (200 - 30) * 360;
    return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
}

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Create and add directional light
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

    connectWebSocket();
    animate();

    // Add smoke effect
    addSmoke();
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
    // Remove old markers that exceed maxMarkerLifetime
    const currentTime = Date.now() / 1000; // Convert to seconds
    soundMarkers = soundMarkers.filter(marker => {
        if ((currentTime - marker.userData.birthTime) < maxMarkerLifetime) {
            return true; // Keep markers within lifetime
        } else {
            // Fade out gradually
            marker.material.opacity -= 0.01; // Adjust fading speed as needed
            if (marker.material.opacity <= 0) {
                scene.remove(marker); // Remove from scene
                return false; // Remove from soundMarkers array
            }
            return true; // Keep marker until fully faded out
        }
    });

    // Add new markers
    activeSounds.forEach(sound => {
        if (soundMarkers.length < maxSoundMarkers) {
            let geometry = new THREE.PlaneGeometry(mapRange(sound.frequency, 30, 200, 0.1, 1), mapRange(sound.frequency, 30, 200, 0.1, 1));

            let material = new THREE.MeshPhongMaterial({
                color: mapFrequencyToColor(sound.frequency),
                shininess: 100,
                reflectivity: 1,
                side: THREE.DoubleSide,
                transparent: true, // Enable transparency
                opacity: 1 // Start with full opacity
            });

            let plane = new THREE.Mesh(geometry, material);

            const positionAttribute = geometry.attributes.position;
            const spawnPoint = new THREE.Vector3();
            for (let i = 0; i < positionAttribute.count; i++) {
                spawnPoint.copy(spawnPosition);
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positionAttribute, i);
                vertex.multiplyScalar(0.5); // Scale down to avoid extending too far
                spawnPoint.add(vertex);
                positionAttribute.setXYZ(i, spawnPoint.x, spawnPoint.y, spawnPoint.z);
            }
            positionAttribute.needsUpdate = true;

            plane.userData.frequency = sound.frequency;
            plane.userData.lfoFrequency = sound.lfo_frequency;
            plane.userData.torusAngle = 0; // Adjust as needed
            plane.userData.angle = 0; // Adjust as needed
            plane.userData.birthTime = currentTime; // Set birth time

            soundMarkers.push(plane);
            scene.add(plane);
        }
    });

    updateDebugInfo({ activeMarkers: soundMarkers.length });
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function animate() {
    requestAnimationFrame(animate);

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

    // Rotate directional light
    directionalLight.position.x = Math.sin(Date.now() * 0.001) * 5;
    directionalLight.position.y = Math.cos(Date.now() * 0.001) * 5;
    directionalLight.position.z = Math.sin(Date.now() * 0.001) * 5;

    // Update sound markers
    soundMarkers.forEach(marker => {
        marker.userData.angle += 0.005;

        marker.rotation.x += markerRotationSpeed * (marker.userData.frequency / 100);
        marker.rotation.y += markerRotationSpeed * (marker.userData.lfoFrequency / 200);

        const torusX = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.cos(marker.userData.angle);
        const torusY = ringRadius * Math.sin(marker.userData.torusAngle);
        const torusZ = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.sin(marker.userData.angle);

        marker.position.set(torusX, torusY, torusZ);
    });

    // Update the smoke shader time uniform
    if (scene.getObjectByName('smokeParticles')) {
        const smokeParticles = scene.getObjectByName('smokeParticles');
        smokeParticles.material.uniforms.time.value += 0.01;
    }

    renderer.render(scene, camera);
}

function addSmoke() {
    // Shader for smoke particles
    const smokeVertexShader = `
        uniform float time;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition;
        }
    `;

    const smokeFragmentShader = `
        uniform float time;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            float t = time * 0.5;
            uv -= 0.5;
            uv *= 1.0 - abs(sin(t));
            uv += 0.5;

            vec3 color = vec3(1.0, 1.0, 1.0);
            color *= 1.0 - length(uv - 0.5);
            color *= 0.5 + 0.5 * sin(time * 3.0);

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const smokeGeometry = new THREE.BufferGeometry();
    const smokeVertices = [];

    for (let i = 0; i < 100; i++) {
        const x = Math.random() * 10 - 5;
        const y = Math.random() * 10 - 5;
        const z = Math.random() * 10 - 5;
        smokeVertices.push(x, y, z);
    }

    smokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(smokeVertices, 3));

    const smokeMaterial = new THREE.ShaderMaterial({
        vertexShader: smokeVertexShader,
        fragmentShader: smokeFragmentShader,
        uniforms: {
            time: { value: 0 }
        },
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    const smokeParticles = new THREE.Points(smokeGeometry, smokeMaterial);
    smokeParticles.name = 'smokeParticles';
    scene.add(smokeParticles);

    // Update the time uniform in the shader
    renderer.animate(() => {
        smokeMaterial.uniforms.time.value += 0.01;
    });
}

document.addEventListener("DOMContentLoaded", function () {
    init();
    setInterval(getActiveSounds, 100);
});

function getActiveSounds() {
    const message = {
        type: "get_all_playing_sounds"
    };
    ws.send(JSON.stringify(message));
}
