from pathlib import Path

root = Path(__file__).parent
source = (root / "ycb-official-certificate-preview.html").read_text(encoding="utf-8")
replacements = {
    "<div><b>Reference:</b> 4119</div>": "<div><b>Reference:</b> YCB-DEMO-2026-091</div>",
    "<div><b>DATE:</b> 07 AUG 2025</div>": "<div><b>DATE:</b> 08 SEP 2026</div>",
    "[CUSTOMER_NAME]": "أحمد محمد القحطاني",
    "[ACCOUNT_TYPE]": "Current",
    "[ACCOUNT_NUMBER]": "YCB-0045827319",
    "[BALANCE_IN_WORDS] ([BALANCE_NUMERIC] [CURRENCY])": "One Million Two Hundred Fifty Thousand Yemeni Rials (1,250,000 YER)",
    "[AS_OF_DATE]": "08 September 2026",
    "[AUTHORIZED_OFFICER_NAME]": "سارة عبدالله المقطري",
    "[BRANCH_MANAGER_NAME]": "خالد علي الحضرمي",
}
for old, new in replacements.items():
    source = source.replace(old, new)
source = source.replace("top:10px;left:10px;", "bottom:10px;left:10px;top:auto;")
source = source.replace("Official Bank Certificate Preview", "YCB Demo Certificate — Sample Data")
source = source.replace('<div class="draft">DRAFT — CLEAN OFFICIAL CERTIFICATE PREVIEW</div>', "")
(root / "ycb-demo-certificate.html").write_text(source, encoding="utf-8")
(root / "ycb-demo-certificate-data.txt").write_text(
    "بيانات تجريبية وهمية بالكامل — لا تمثل عميلاً أو حساباً حقيقياً.\n"
    "اسم العميل: أحمد محمد القحطاني\n"
    "نوع الحساب: Current\n"
    "رقم الحساب: YCB-0045827319\n"
    "الرصيد: 1,250,000 YER\n"
    "التاريخ: 08 September 2026\n"
    "المرجع: YCB-DEMO-2026-091\n"
    "خدمة العملاء: سارة عبدالله المقطري\n"
    "مدير الفرع: خالد علي الحضرمي\n",
    encoding="utf-8",
)
print(root / "ycb-demo-certificate.html")
print(root / "ycb-demo-certificate-data.txt")
