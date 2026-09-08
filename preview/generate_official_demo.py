from pathlib import Path
import re

preview = Path(__file__).parent
root = preview.parent
module = (root / "client/src/lib/ycbOfficialCertificateTemplate.ts").read_text(encoding="utf-8")
match = re.search(r"= `([\s\S]*)`;\s*$", module)
if not match:
    raise SystemExit("Could not locate the certificate template literal")
source = match.group(1)
replacements = {
    "<div><b>Reference:</b> 4119</div>": "<div><b>Reference:</b> YCB-DEMO-2026-091</div>",
    "<div><b>DATE:</b> 07 AUG 2025</div>": "<div><b>DATE:</b> 08 SEP 2026</div>",
    "[AS_OF_DATE_HIJRI]": "٢٦ ربيع الأول ١٤٤٨ هـ",
    "[CUSTOMER_NAME]": "Ahmed Mohammed Al-Qahtani",
    "[ACCOUNT_TYPE]": "Current Account",
    "[ACCOUNT_NUMBER]": "YCB-0045827319",
    "[BALANCE_IN_WORDS]": "One Million Two Hundred Fifty Thousand Yemeni Rials",
    "[BALANCE_NUMERIC]": "1,250,000",
    "[CURRENCY]": "YER",
    "[AS_OF_DATE]": "08 September 2026",
    "[AUTHORIZED_OFFICER_NAME]": "Sarah Abdullah Al-Maqtari",
    "[BRANCH_MANAGER_NAME]": "Khaled Ali Al-Hadrami",
}
for old, new in replacements.items():
    source = source.replace(old, new)
source = source.replace("ycb-official-letterhead.png", "ycb-official-letterhead.png")
(preview / "ycb-official-demo.html").write_text(source, encoding="utf-8")
print(preview / "ycb-official-demo.html")
