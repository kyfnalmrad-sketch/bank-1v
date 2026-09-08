from pathlib import Path
path = Path('/home/ubuntu/bank-karimi-web-staging/preview/ycb-official-certificate-preview.html')
html = path.read_text()
html = html.replace('top:12mm;left:12mm;width:25mm', 'top:2mm;left:0mm;width:25mm')
html = html.replace('top:38mm;left:12mm;width:25mm', 'top:28mm;left:0mm;width:25mm')
path.write_text(html)
print('QR moved 10mm upward and aligned to top/side edges')
