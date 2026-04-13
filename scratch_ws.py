import asyncio
import websockets

async def test():
    try:
        async with websockets.connect('ws://localhost:8080/ws/voice') as ws:
            print("Connected")
            # Send valid sine wave to trigger VAD
            import math, struct
            pcm = bytearray()
            # 1 second of 440hz sine wave 16000 rate, int16
            for i in range(16000):
                val = int(math.sin(i * 440.0 * 2.0 * math.pi / 16000.0) * 8000)
                pcm.extend(struct.pack('<h', val))
            
            await ws.send(pcm)
            print("Sent 1 sec audio")
            
            # send some more audio
            await ws.send(pcm)
            print("Sent 2 sec audio total")
            
            for _ in range(5):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=3)
                    if isinstance(msg, bytes):
                        print(f"Received bytes: {len(msg)}")
                    else:
                        print(f"Received string: {msg}")
                except asyncio.TimeoutError:
                    print("Timeout waiting for response...")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
