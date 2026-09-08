from pathlib import Path
import ast

preview = Path(__file__).parent
root = preview.parent
module = (root / "client/src/lib/ycbOfficialCertificateTemplate.ts").read_text(encoding="utf-8")
source = ast.literal_eval(module.split("= ", 1)[1].rsplit(";", 1)[0])
replacements = {
    "<div><b>Reference:</b> 4119</div>": "<div><b>Reference:</b> YCB-DEMO-2026-091</div>",
    "<div><b>DATE:</b> 07 AUG 2025</div>": "<div><b>DATE:</b> 08 SEP 2026</div>",
    "[CUSTOMER_NAME]": "أحمد محمد القحطاني",
    "[ACCOUNT_TYPE]": "Current",
    "[ACCOUNT_NUMBER]": "YCB-0045827319",
    "[BALANCE_IN_WORDS]": "One Million Two Hundred Fifty Thousand Yemeni Rials",
    "[BALANCE_NUMERIC]": "1,250,000",
    "[CURRENCY]": "YER",
    "[AS_OF_DATE]": "08 September 2026",
    "[AUTHORIZED_OFFICER_NAME]": "سارة عبدالله المقطري",
    "[BRANCH_MANAGER_NAME]": "خالد علي الحضرمي",
}
for old, new in replacements.items():
    source = source.replace(old, new)
source = source.replace("ycb-official-letterhead.png", "ycb-official-letterhead.png")
(preview / "ycb-official-demo.html").write_text(source, encoding="utf-8")
print(preview / "ycb-official-demo.html")
