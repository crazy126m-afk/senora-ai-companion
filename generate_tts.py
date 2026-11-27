import sys
import os
import re
import asyncio
import edge_tts

def clean_text(text):
    # Remove action tags
    text = re.sub(r'\[ACTION:[^\]]+\]', '', text)
    # Remove all emojis and symbols so they are never spoken aloud
    text = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27bf\u2300-\u23ff\ufe0f\u200d]', '', text)
    # Remove markdown chars
    text = re.sub(r'[*_#`~[\]]', '', text)
    return text.strip()

async def main():
    if len(sys.argv) < 4:
        sys.exit(1)
    raw_text = sys.argv[1]
    voice = sys.argv[2]
    out_file = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else '+18%'
    pitch = sys.argv[5] if len(sys.argv) > 5 else '+22Hz' # 17-year-old sweet youthful pitch
    
    text = clean_text(raw_text)
    if not text:
        text = 'Ji boliye!'
        
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(out_file)

if __name__ == '__main__':
    asyncio.run(main())
