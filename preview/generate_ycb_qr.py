from pathlib import Path
import qrcode

payload = "YCB|BANK_CERTIFICATE|REFERENCE_NUMBER|ISSUE_DATE"
image = qrcode.make(payload)
out = Path('/home/ubuntu/bank-karimi-web-staging/preview/ycb-certificate-qr.png')
image.save(out)
print(out)
