from pathlib import Path

root = Path(__file__).parents[1]
component = root / "client/src/components/YcbCertificateWorkspace.tsx"
text = component.read_text(encoding="utf-8")
needle = "</style></head><body>"
insert = "header{height:0;border:0;padding:0;overflow:visible}header .brand,header .brand-ar{visibility:hidden}.meta{position:fixed;top:47mm;right:21mm;visibility:visible}.sheet{background:#fff url('/assets/ycb-official-letterhead.png') center/100% 100% no-repeat}.sheet:before{display:none}.content{top:64mm;right:21mm;left:21mm;padding:0}footer{display:none}"
if needle not in text:
    raise SystemExit("official template insertion point not found")
text = text.replace(needle, insert + needle, 1)
component.write_text(text, encoding="utf-8")
assets = root / "client/public/assets"
assets.mkdir(parents=True, exist_ok=True)
for name in ("ycb-official-letterhead.png", "ycb-certificate-qr.png"):
    source = root / "preview" / name
    target = assets / name
    target.write_bytes(source.read_bytes())
print("official YCB assets copied and template linked")
