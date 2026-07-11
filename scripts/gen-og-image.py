#!/usr/bin/env python3
"""Generate a default OG image (1200x630 PNG) for the portal."""
from PIL import Image, ImageDraw, ImageFont
import os

width, height = 1200, 630
bg_color = (37, 99, 235)  # #2563eb
text_color = (255, 255, 255)

img = Image.new('RGB', (width, height), bg_color)
draw = ImageDraw.Draw(img)

# Try to use a system font
try:
    font_large = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 72)
    font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 32)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Draw text centered
title = 'Portal de Notícias'
subtitle = 'Jornalismo & Verdade'

# Get text bounding boxes for centering
bbox_large = draw.textbbox((0, 0), title, font=font_large)
bbox_small = draw.textbbox((0, 0), subtitle, font=font_small)

x_large = (width - (bbox_large[2] - bbox_large[0])) // 2
x_small = (width - (bbox_small[2] - bbox_small[0])) // 2

draw.text((x_large, 240), title, fill=text_color, font=font_large)
draw.text((x_small, 340), subtitle, fill=(255, 255, 255, 200), font=font_small)

output_path = '/home/z/my-project/public/og-default.png'
img.save(output_path, 'PNG')
print(f'✅ OG image saved to {output_path} ({os.path.getsize(output_path)} bytes)')
