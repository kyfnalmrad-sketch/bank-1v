from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/1788883592275.png')
target = Path('/home/ubuntu/bank-karimi-web-staging/client/src/assets/ycb-logo-transparent.png')
target.parent.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('RGBA')
pixels = image.load()
for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = pixels[x, y]
        # Remove the white background and white interior gaps while preserving YCB blue.
        if r > 235 and g > 235 and b > 235:
            pixels[x, y] = (r, g, b, 0)
        else:
            pixels[x, y] = (r, g, b, a)
image.save(target, 'PNG', optimize=True)
print(target)
print(image.size)
print('transparent pixels:', sum(1 for pixel in image.getdata() if pixel[3] == 0))
