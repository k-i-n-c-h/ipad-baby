//import * as THREE from './three';

let ws;
let scene, camera, renderer;
let soundMarkers = [];
let smokeParticles;
const maxSoundMarkers = 1000;
const moveSpeed = 0.05;
const rotateSpeed = 0.001;
const keys = {};
const torusRadius = 2;
const markerRotationSpeed = 0.02;
const ringRadius = 5;
const maxMarkerLifetime = 12; // Maximum lifetime of markers in seconds

function connectWebSocket() {
    ws = new WebSocket("ws://127.0.0.1:8765");

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
    let hue = (frequency - 30) / (600 - 30) * 360;
    return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
}

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadow mapping
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xa0a0a0);
    scene.add(ambientLight);

    const directionalLight2 = new THREE.DirectionalLight(0xff0000, 0.5);
    directionalLight2.position.set(0, 0, 1).normalize();
    directionalLight2.castShadow = true; // Enable shadow casting
    scene.add(directionalLight2);

    const directionalLight1 = new THREE.DirectionalLight(0x00ff00, 0.5);
    directionalLight1.position.set(0, 1, 1).normalize();
    directionalLight1.castShadow = true; // Enable shadow casting
    scene.add(directionalLight1);

    const directionalLight = new THREE.DirectionalLight(0x0000ff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    directionalLight.castShadow = true; // Enable shadow casting
    scene.add(directionalLight);

    // Adjust shadow map settings for better quality
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;

    directionalLight1.shadow.mapSize.width = 1024;
    directionalLight1.shadow.mapSize.height = 1024;
    directionalLight1.shadow.camera.top = 10;
    directionalLight1.shadow.camera.bottom = -10;
    directionalLight1.shadow.camera.left = -10;
    directionalLight1.shadow.camera.right = 10;

    directionalLight2.shadow.mapSize.width = 1024;
    directionalLight2.shadow.mapSize.height = 1024;
    directionalLight2.shadow.camera.top = 10;
    directionalLight2.shadow.camera.bottom = -10;
    directionalLight2.shadow.camera.left = -10;
    directionalLight2.shadow.camera.right = 10;

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

    connectWebSocket();
    createSmokeEffect();
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
    const currentTime = Date.now() / 1000;

    soundMarkers = soundMarkers.filter(marker => {
        if ((currentTime - marker.userData.birthTime) < maxMarkerLifetime) {
            return true; // Keep markers within lifetime
        } else {
            marker.material.opacity -= 0.1;
            if (marker.material.opacity <= 0) {
                scene.remove(marker);
                return false;
            }
            return true;
        }
    });

    activeSounds.forEach(sound => {
        if (soundMarkers.length < maxSoundMarkers) {
            let geometry = new THREE.PlaneGeometry(mapRange(sound.frequency, 30, 600, .1, 3), mapRange(sound.frequency, 30, 600, .1, 3));

            let material = new THREE.MeshPhongMaterial({
                color: mapFrequencyToColor(sound.frequency),
                shininess: 100,
                reflectivity: 1,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1
            });

            let plane = new THREE.Mesh(geometry, material);
            plane.castShadow = true; // Enable shadow casting
            plane.receiveShadow = true; // Enable shadow receiving

            const positionAttribute = geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positionAttribute, i);
                vertex.x += sound.frequency/sound.lfo_frequency/100;
                vertex.y += sound.lfo_frequency/sound.lfo_frequency/100;
                vertex.z += sound.frequency/sound.lfo_frequency/100;
                positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
            positionAttribute.needsUpdate = true;

            const initialAngle = 0;
            const toroidalAngle = sound.frequency;
            const torusX = (torusRadius + ringRadius * Math.cos(toroidalAngle)) * Math.cos(initialAngle);
            const torusY = ringRadius * Math.sin(sound.lfo_frequency);
            const torusZ = (torusRadius + ringRadius * Math.cos(toroidalAngle)) * Math.sin(initialAngle);

            plane.position.set(torusX, torusY, torusZ);

            plane.userData.frequency = sound.frequency;
            plane.userData.pan = sound.pan;
            plane.userData.lfoFrequency = sound.lfo_frequency;
            plane.userData.torusAngle = toroidalAngle;
            plane.userData.angle = initialAngle;
            plane.userData.birthTime = currentTime;

            soundMarkers.push(plane);
            scene.add(plane);
        }
    });

    updateDebugInfo({ activeMarkers: soundMarkers.length });
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function createSmokeEffect() {
    const smokeGeometry = new THREE.BufferGeometry();
    const smokeVertices = [];

    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * Math.sin(i) * 22 - 2.5;
        const y = Math.random() * Math.cos(i) * 22 - 3.5;
        const z = Math.random() * 6 * Math.cos(i);
        smokeVertices.push(x, y, z);
    }

    smokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(smokeVertices, 3));

    const smokeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 2.0 }
        },
        vertexShader: `
uniform float time;
varying vec2 vUv;

void main() {
    vUv = uv;

    vec3 newPosition = position; // Define newPosition here

    // Example deformation based on sound data or time
    newPosition.x += sin(time * newPosition.z);
    newPosition.y += cos(time * newPosition.y);
    newPosition.z += sin(time * newPosition.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
        `,
        fragmentShader: `
uniform float intensity;
uniform vec3 color;
varying vec2 vUv;

void main() {
    gl_FragColor = vec4(color, intensity);
}

        `
    });

    smokeParticles = new THREE.Points(smokeGeometry, smokeMaterial);
    scene.add(smokeParticles);
}

function updateSmokeEffect(time) {
    if (smokeParticles) {
        smokeParticles.material.uniforms.time.value = time;

        // Update smoke particles based on sound data or other parameters
        // Example: move particles based on camera movement or sound markers
        smokeParticles.rotation.y += 0.0005;// * Math.sin(time * 0.5);
        //smokeParticles.rotation.x += 0.0001 * Math.cos(time * 0.5);
    }
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001; // Convert to seconds

    updateSmokeEffect(time / soundMarkers.length);

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

    soundMarkers.forEach(marker => {
        marker.userData.angle += (1 - marker.userData.pan) / 15;//1 - marker.userData.pan / 100;//0.005;

        marker.rotation.x += (marker.userData.frequency / 1000); // Adjust rotation speed based on frequency
        marker.rotation.y += (marker.userData.lfoFrequency / 100);
        marker.rotation.z += (marker.userData.pan * 0.001);
        const torusX = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.cos(marker.userData.angle);
        const torusY = torusRadius + ringRadius * Math.sin(time - marker.userData.birthTime) * Math.cos(marker.userData.angle);
        const torusZ = (torusRadius + ringRadius * Math.cos(marker.userData.torusAngle)) * Math.sin(marker.userData.angle);

        marker.position.set(torusX, torusY, torusZ);
    });

    renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", function () {
    init();
    setInterval(getActiveSounds, 30); // Poll for active sounds every 300ms
});

function getActiveSounds() {
    const message = {
        type: "get_all_playing_sounds"
    };
    ws.send(JSON.stringify(message));
}

