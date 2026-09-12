export const ycbOfficialCertificateTemplate = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8"><title>Yemen Commercial Bank Certificate</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#e9eef4}
body{font-family:Arial,Calibri,sans-serif;color:#172a63}
.page{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff url('ycb-official-letterhead.png') center/100% 100% no-repeat;overflow:hidden}
.header-qr{position:absolute;top:2mm;left:0;width:25mm;height:25mm;object-fit:contain}
.header-qr-label{position:absolute;top:28mm;left:0;width:25mm;text-align:center;font:8px Arial,sans-serif;color:#172a63}
.header-meta{position:absolute;top:47mm;left:16mm;width:82mm;text-align:left;font-size:10pt;line-height:1.65;color:#172a63}
.header-meta div{white-space:nowrap}
.header-hijri{position:absolute;top:47mm;right:16mm;width:82mm;text-align:right;direction:rtl;font-size:10pt;line-height:1.65;color:#172a63}
.header-hijri div{white-space:nowrap}
.header-customer-since{position:absolute;top:58mm;right:16mm;width:82mm;text-align:right;font-size:9.5pt;line-height:1.4;color:#b28a2e;font-weight:700}
.header-customer-since:empty{display:none}
.content{position:absolute;top:72mm;left:16mm;right:16mm}
.title{text-align:center;font-size:18pt;font-weight:700;letter-spacing:.2px;text-transform:uppercase;text-decoration:underline;text-decoration-thickness:1.2pt;text-underline-offset:2.2pt;margin:9mm 0 12mm;padding:0}
.body{width:182mm;margin:0 auto;font-size:18pt;font-weight:400;line-height:1.5;text-align:left;color:#151b29;word-break:normal;overflow-wrap:normal;hyphens:none}
.body p{margin:0 0 10mm}
.body .strong{font-size:18pt;font-weight:700}.body p .strong{white-space:nowrap;display:inline-block}
.disclaimer{font-size:10.5pt!important;line-height:1.42!important;margin:0 auto!important;color:#a30000;text-align:center}
.closing{font-size:16pt;font-weight:700;text-align:center;margin-top:clamp(8mm,2.5vw,11mm);color:#151b29}
.signatures{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:clamp(16mm,6vw,24mm);margin:clamp(8mm,2.5vw,12mm) 0 0;position:relative;z-index:2}
.signature{text-align:center;font-size:12pt;line-height:1.45;color:#151b29;min-height:27mm;min-width:0}
.signature .role{display:block;font-weight:700;font-size:18pt}
.signature .name{display:block;font-weight:400;font-size:18pt;white-space:nowrap;letter-spacing:-.1px}
.signature .stamp-space{display:block;height:10mm}
.notice{position:absolute;bottom:30mm;left:16mm;right:16mm;text-align:center;font-size:9pt;line-height:1.35;color:#a30000}
@media print{body{background:#fff}.page{margin:0}}
</style>
</head>
<body>
<section class="page">
  <img class="header-qr" src="ycb-certificate-qr.png" alt="YCB Verification"><div class="header-qr-label">YCB Verification</div>
  <div class="header-meta"><div><b>Reference:</b> 4119</div><div><b>DATE:</b> 07 AUG 2025</div></div>
  <div class="header-hijri"><div><b>التاريخ الهجري:</b> [AS_OF_DATE_HIJRI]</div></div>
  <div class="header-customer-since">[CUSTOMER_SINCE_LINE]</div>
  <main class="content">
    <h1 class="title">TO WHOM IT MAY CONCERN</h1>
    <section class="body">
      <p>Best regards are presented to you from Yemen Commercial Bank, and we wish you continued success.</p>
      <p>We, at Yemen Commercial Bank, hereby confirm that our client, <span class="strong">[CUSTOMER_NAME]</span>[PASSPORT_LINE][BIRTH_DATE_LINE], holds a <span class="strong">[ACCOUNT_TYPE]</span> with us under account number <span class="strong">[ACCOUNT_NUMBER]</span> with a total bank balance of <span class="strong">[BALANCE_NUMERIC] [CURRENCY]</span> as of [AS_OF_DATE].[PERIOD_LINE].</p>
    </section>
    <div class="closing">Yours faithfully,</div>
    <section class="signatures">
      <div class="signature"><span class="stamp-space"></span><span class="role">Customer Service</span><span class="name">[AUTHORIZED_OFFICER_NAME]</span></div>
      <div class="signature"><span class="stamp-space"></span><span class="role">Branch Manager</span><span class="name">[BRANCH_MANAGER_NAME]</span></div>
    </section>
  </main>
  <div class="notice">Note: This certificate is issued upon the customer's request without any financial liability or commitment on the bank, and is valid as of the date stated above.</div>
</section>
</body>
</html>`;
