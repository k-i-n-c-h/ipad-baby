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
        # Send data every 2 seconds
        await websocket.send(json.dumps({"type": "stop_audio"}))
        await asyncio.sleep(1) 
        # Wait for 1 second after stopping audio

async def receive_active_sounds(websocket):
    while True:
        await asyncio.sleep(3)  # Poll every 300ms
        
        # Send request to get active sounds
        await websocket.send(json.dumps({"type": "get_all_playing_sounds"}))
        
        # Receive active sounds response
        response = await websocket.recv()
        data = json.loads(response)
        
        if data["type"] == "active_sounds":
            active_sounds = data["data"]
            print(f"Received active sounds: {active_sounds}")
            
            # Calculate harmonizing frequencies based on active sounds
            harmonizing_frequencies = []
            for sound in active_sounds:
                original_frequency = sound["frequency"]
                lfo_frequency = sound.get("lfo_frequency", 0) * random.choice([.75, .5, .25, 1.25, 1.75, 1.5])  # Default to 0 if lfo_frequency is missing
                pan = sound.get("pan", 0.5)  # Default to 0.5 if pan is missing
                harmonic_frequency = original_frequency * random.choice([.75, .5, .25, 1.25, 1.75, 1.5])  # Example: play a harmonic frequency
                if harmonic_frequency > 40 and harmonic_frequency < 1500:
                    sendfreq = harmonic_frequency
                elif harmonic_frequency > 1500:
                    sendfreq = harmonic_frequency * 2
                else:
                    sendfreq = harmonic_frequency * 2
                harmonizing_frequencies.append({
                    "type": "play_signal_oscillator",
                    "frequency": sendfreq,
                    "lfo_frequency": lfo_frequency,
                    "pan": random.uniform(0, 1)
                })
            
            # Send commands to play harmonizing frequencies
            for freq_message in harmonizing_frequencies:
                await websocket.send(json.dumps(freq_message))
                print(f"Sent harmonizing sound data: {freq_message}")
                await asyncio.sleep(3)
                await websocket.send(json.dumps({"type": "stop_audio"}))


async def connect_websocket(uri):
    async with websockets.connect(uri) as websocket:
        print(f"WebSocket connected to {uri}")
        
        # Start sending sound data
        # send_task = asyncio.create_task(send_sound_data(websocket, uri))
        
        # Start receiving active sounds and play harmonizing frequencies
        await receive_active_sounds(websocket)
        
        # Wait for send_sound_data task to complete
        await send_task

if __name__ == "__main__":
    uri = "ws://localhost:8765"  # Adjust with your server URL
    asyncio.run(connect_websocket(uri))
