import asyncio
import websockets
import json

async def send_message():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        message = {
            "type": "play_audio",
            "content": "Triggering audio playback",
            "device": "example_client"
        }
        await websocket.send(json.dumps(message))
        print(f"Sent message: {message}")

if __name__ == "__main__":
    asyncio.run(send_message())
