import asyncio
import websockets
import json
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
import pygame
import numpy as np
from time import time

# Initialize Pygame mixer
pygame.mixer.pre_init(44100, -16, 2, 64)  # Initialize mixer settings before pygame.init()
pygame.init()
pygame.mixer.init()

# Dictionary to store clients and their respective sound objects
clients = {}

# Dictionary to store active sounds
active_sounds = {}

# Function to generate LFO signal based on shape
def generate_lfo(t, lfo_frequency, lfo_shape):
    if lfo_shape == "sine":
        return np.sin(2 * np.pi * lfo_frequency * t)
    elif lfo_shape == "triangle":
        return 2 * np.abs(2 * (t * lfo_frequency - np.floor(t * lfo_frequency + 0.5))) - 1
    elif lfo_shape == "square":
        return np.sign(np.sin(2 * np.pi * lfo_frequency * t))

    return np.zeros_like(t)  # Default to zero if shape is not recognized

# Function to generate and play a signal oscillator sound without fades
async def play_signal_oscillator(frequency, lfo_frequency, lfo_shape, pan, client_id):
    sample_rate = 44100  # Sample rate (samples per second)
    duration_sec = 12   # Duration of each audio buffer in seconds
    default_volume = 0.7  # Default volume (half as loud)
    fade_duration = 0.005  # Fade-in duration in seconds

    # Generate time vector
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)

    # Generate LFO signal
    lfo_signal = generate_lfo(t, lfo_frequency, lfo_shape)

    # Generate signal oscillator with frequency and LFO
    signal = np.sin(2 * np.pi * frequency * t + lfo_signal)

    # Scale signal amplitude for default volume
    signal *= default_volume

    # Adjust volume for left and right channels based on pan
    left_volume = default_volume * (1 - pan)
    right_volume = default_volume * pan

    # Create stereo signal with adjusted volumes
    stereo_signal = np.zeros((len(signal), 2), dtype=np.float32)
    stereo_signal[:, 0] = signal * left_volume
    stereo_signal[:, 1] = signal * right_volume

    # Convert to 16-bit signed integers (required by Pygame)
    stereo_signal = (stereo_signal * 32767.0).astype(np.int16)

    # Create a Pygame sound object
    sound = pygame.mixer.Sound(buffer=stereo_signal)

    # Store the sound object for the client
    clients[client_id]["current_sound"] = sound

    # Track the sound in active sounds with the end time
    active_sounds[client_id] = {
        "client_id": client_id,
        "sound": sound,
        "pan": pan,
        "frequency": frequency,
        "lfo_frequency": lfo_frequency,
        "lfo_shape": lfo_shape,
        "end_time": time() + duration_sec  # Track when the sound should end
    }





    # Start playing the sound
    sound.set_volume(0)
    sound.play()
        # Start playing the sound with fade-in effect
    fade_in_steps = int(sample_rate * fade_duration)
    for i in range(fade_in_steps):
        current_volume = default_volume * (i / fade_in_steps)
        sound.set_volume(current_volume)
        await asyncio.sleep(1 / sample_rate)
    # Ensure final volume is set to default_volume
    sound.set_volume(default_volume)

async def register(websocket):
    client_id = id(websocket)
    clients[client_id] = {"websocket": websocket, "current_sound": None}
    print(f"Client connected: {client_id}")

async def unregister(websocket):
    client_id = id(websocket)
    if client_id in clients:
        clients.pop(client_id)
        print(f"Client disconnected: {client_id}")
        # Remove from active sounds
        if client_id in active_sounds:
            active_sounds.pop(client_id)

async def handler(websocket, path):
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            await process_message(data, websocket)
    except websockets.ConnectionClosed:
        pass
    finally:
        await unregister(websocket)

async def process_message(message, websocket):
    client_id = id(websocket)

    print(f"Received message from {client_id}: {message}")

    if message.get("type") == "play_signal_oscillator":
        frequency = message.get("frequency", 440)  # Default to 440Hz if not specified
        lfo_frequency = message.get("lfo_frequency", 0)  # Default LFO frequency
        lfo_shape = message.get("lfo_shape", "sine")  # Default LFO shape
        pan = message.get("pan", 0.5)  # Default pan value (centered)

        # Stop any currently playing sound for this client
        if clients[client_id]["current_sound"]:
            clients[client_id]["current_sound"].fadeout(10)

        # Start playing the signal oscillator asynchronously
        await play_signal_oscillator(frequency, lfo_frequency, lfo_shape, pan, client_id)
    elif message.get("type") == "stop_audio":
        # Stop the currently playing sound for this client
        if clients[client_id]["current_sound"]:
            clients[client_id]["current_sound"].fadeout(1000)
            # Remove from active sounds
            if client_id in active_sounds:
                active_sounds.pop(client_id)
    elif message.get("type") == "get_all_playing_sounds":
        # Send back information about all currently playing sounds
        await send_all_playing_sounds(websocket)
    elif message.get("type") == "get_other_clients_actions":
        # Send back information about all other clients' actions
        await send_other_clients_actions(websocket)

async def send_all_playing_sounds(websocket):
    playing_sounds_info = []
    for sound_data in active_sounds.values():
        sound_info = {
            "client_id": sound_data["client_id"],
            "frequency": sound_data["frequency"],
            "lfo_frequency": sound_data["lfo_frequency"],
            "pan": sound_data["pan"],
            "lfo_shape": sound_data["lfo_shape"],
            "is_playing": sound_data["sound"].get_length() > 0,
            "length_sec": sound_data["sound"].get_length(),
            "volume": sound_data["sound"].get_volume()
        }
        playing_sounds_info.append(sound_info)
    await websocket.send(json.dumps({"type": "active_sounds", "data": playing_sounds_info}))

async def send_other_clients_actions(websocket):
    requesting_client_id = id(websocket)
    other_clients_actions = []
    for sound_data in active_sounds.values():
        if sound_data["client_id"] != requesting_client_id:
            action_info = {
                "client_id": sound_data["client_id"],
                "frequency": sound_data["frequency"],
                "lfo_frequency": sound_data["lfo_frequency"],
                "lfo_shape": sound_data["lfo_shape"]
            }
            other_clients_actions.append(action_info)
    await websocket.send(json.dumps({"type": "other_clients_actions", "data": other_clients_actions}))

async def remove_expired_sounds():
    while True:
        current_time = time()
        expired_sounds = [client_id for client_id, sound_data in active_sounds.items() if sound_data["end_time"] <= current_time]
        for client_id in expired_sounds:
            active_sounds.pop(client_id)
        await asyncio.sleep(1)

async def start_websocket_server():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket server started on ws://0.0.0.0:8765")
        await remove_expired_sounds()  # Start the task to remove expired sounds

# HTTP server with CORS support
class SimpleHTTPRequestHandlerWithCORS(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_http_server():
    handler = SimpleHTTPRequestHandlerWithCORS
    httpd = HTTPServer(("0.0.0.0", 8000), handler)
    print("HTTP server started on http://0.0.0.0:8000")
    httpd.serve_forever()

if __name__ == "__main__":
    # Start HTTP server on a separate thread
    http_thread = threading.Thread(target=start_http_server)
    http_thread.start()

    # Start WebSocket server
    asyncio.run(start_websocket_server())
