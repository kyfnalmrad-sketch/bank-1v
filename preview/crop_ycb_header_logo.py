from pathlib import Path
from PIL import Image

source = Image.open('/home/ubuntu/bank-karimi-web-staging/preview/ycb-official-letterhead.png').convert('RGBA')
# Header logo occupies the central-right area of the supplied A4 letterhead.
crop = source.crop((500, 0, 1324, 310))
pixels = crop.load()
for y in range(crop.height):
    for x in range(crop.width):
        r, g, b, a = pixels[x, y]
        if r > 238 and g > 238 and b > 238:
            pixels[x, y] = (255, 255, 255, 0)
crop.thumbnail((760, 220), Image.Resampling.LANCZOS)
out = Path('/home/ubuntu/bank-karimi-web-staging/preview/ycb-header-logo-transparent.png')
crop.save(out)
print(out)
