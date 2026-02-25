import os, re, traceback
os.chdir(r'c:\Users\firas\Desktop\PFE Project\learnai-ai-service')

print("Testing MoviePy ffmpeg config...")
from moviepy.config import FFMPEG_BINARY
print(f"MoviePy FFMPEG_BINARY = {FFMPEG_BINARY}")

print("\nGenerating test video...")
try:
    from moviepy import ColorClip, TextClip, CompositeVideoClip, concatenate_videoclips

    W, H = 1280, 720
    FONT = r'C:\Windows\Fonts\arial.ttf'

    bg = ColorClip(size=(W, H), color=(15, 20, 40), duration=4.0)
    t  = TextClip(
        text='Test Lesson', font=FONT, font_size=52,
        color='rgb(248,250,252)', duration=4.0,
        method='caption', size=(W-120, None)
    ).with_position('center')

    s1    = CompositeVideoClip([bg, t], size=(W, H)).with_duration(4.0)
    final = concatenate_videoclips([s1], method='compose')
    out   = os.path.abspath('uploads/recap-videos/realtest.mp4')

    final.write_videofile(out, codec='libx264', audio=False, fps=24, preset='ultrafast', logger=None)
    final.close()
    print(f"\nSUCCESS — {out}  ({os.path.getsize(out)} bytes)")
except Exception as e:
    print(f"\nFAILED: {e}")
    traceback.print_exc()
