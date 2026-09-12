from pathlib import Path
import qrcode

# Preview payload is namespaced for Yemen Commercial Bank and will be populated
# from the independent YCB reference/statement fields in the application.
payload = "B=YCB|D=C|N=-|A=-|R=-|I=-|L=0YER"
image = qrcode.make(payload, box_size=12, border=2)
image = image.convert("RGB")
navy = (23, 42, 99)
white = (255, 255, 255)
pixels = image.load()
for y in range(image.height):
    for x in range(image.width):
        pixels[x, y] = navy if pixels[x, y][0] < 128 else white
out = Path('/home/ubuntu/bank-1v/client/public/assets/ycb-certificate-qr.png')
image.save(out)
print(out)
