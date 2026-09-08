from pathlib import Path
import json

root = Path(__file__).parents[1]
source = (root / "preview/ycb-official-certificate-preview.html").read_text(encoding="utf-8")
# Keep the exact official layout and only leave data placeholders for runtime replacement.
source = source.replace("<div class=\"draft\">DRAFT — CLEAN OFFICIAL CERTIFICATE PREVIEW</div>", "")
source = source.replace("Official Bank Certificate Preview", "Yemen Commercial Bank Certificate")
module = "export const ycbOfficialCertificateTemplate = " + json.dumps(source, ensure_ascii=False) + ";\n"
(root / "client/src/lib/ycbOfficialCertificateTemplate.ts").write_text(module, encoding="utf-8")
print("generated", root / "client/src/lib/ycbOfficialCertificateTemplate.ts")
