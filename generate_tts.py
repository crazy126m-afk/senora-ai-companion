import sys
import asyncio
import edge_tts

async def main():
    if len(sys.argv) < 4:
        sys.exit(1)
    text = sys.argv[1]
    voice = sys.argv[2]
    out_file = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else '+20%'
    pitch = sys.argv[5] if len(sys.argv) > 5 else '+4Hz'
    
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(out_file)

if __name__ == '__main__':
    asyncio.run(main())
