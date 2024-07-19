import asyncio
import websockets
import json
import random
import time

async def send_sound_data(websocket, uri):
    while True:
        frequency = random.uniform(40, 300)
        lfo_frequency = random.uniform(-200, 200)
        pan = random.uniform(0, 1)
        
        message = {
            "type": "play_signal_oscillator",
            "frequency": frequency,
            "lfo_frequency": lfo_frequency,
            "pan": pan
        }
        
        await websocket.send(json.dumps(message))
        print(f"Sent sound data: {message}")
        
        await asyncio.sleep(2)  
        # Send data every 1 second
        await websocket.send(json.dumps({"type": "stop_audio"}))
        await asyncio.sleep(1) 

async def connect_websocket(uri):
    async with websockets.connect(uri) as websocket:
        print(f"WebSocket connected to {uri}")
        await send_sound_data(websocket, uri)

if __name__ == "__main__":
    uri = "ws://localhost:8765"  # Adjust with your server URL
    asyncio.run(connect_websocket(uri))
