import fs from "node:fs/promises";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

const root = new URL("../", import.meta.url);
const templatePath = new URL("client/src/lib/ycb-statement-stage1-revised.html", root);
const outputPath = new URL("preview/ycb-barcode-updated-preview.html", root);
const qrPayload = [
  "YEMEN COMMERCIAL BANK",
  "DOC=ACCOUNT_STATEMENT",
  "PAGE=1/1",
  "CUSTOMER=Ahmed Mohammed Al-Qahtani",
  "PASSPORT=P1234567",
  "ADDRESS=Sana'a - Bab Al-Yemen",
  "BRANCH=AL-ZUBAIRI",
  "ACCOUNT=101-840-21102-326491-000",
  "CURRENCY=USD",
  "PERIOD=05-Feb-2025-24-Jun-2025",
  "ISSUED=24-Jun-2025",
  "REF1=0379297",
  "REFN=0379302",
  "OPS=6",
  "CREDITS=2;9032.00",
  "DEBITS=4;4400.00",
  "OPEN=15283.00",
  "CLOSE=19915.00",
  "STATEMENT=YCB-STMT-2025-001",
].join("\n");
const barcodePayload = "YCB|STMT|DOC=YCB-STMT-2025-001|PAGE=1/1|REF1=0379297|REFN=0379302|OPS=6|OPEN=15283.00|CLOSE=19915.00|CHK=DEMO2026";
const qr = await QRCode.toDataURL(qrPayload, { width: 520, margin: 2, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } });
const barcodeSvg = bwipjs.toSVG({ bcid: "pdf417", text: barcodePayload, scaleX: 2, scaleY: 2, padding: 4, backgroundcolor: "FFFFFF", barcolor: "2D3192" });
const barcode = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(barcodeSvg)}`;
let html = await fs.readFile(templatePath, "utf8");
html = html.replace(/(<img class="address-qr" src=")[^"]*(")/, `$1${qr}$2`);
html = html.replace(/(<img class="title-pdf417" src=")[^"]*(")/, `$1${barcode}$2`);
html = html.replace("Sana'a — Bab Al-Yemen", "Sana'a — Bab Al-Yemen<div style=\"margin-top:1.2mm;font-size:8pt;line-height:1.18\"><span style=\"display:block;font-weight:800;font-style:italic;text-transform:uppercase\">Date of Birth:</span><span style=\"display:block;margin-top:.7mm\">12-Apr-1988</span></div>");
html = html.replace("</head>", "<style>.address-qr{width:17mm!important;height:17mm!important}.title-pdf417{width:52mm!important;height:10mm!important;object-fit:fill!important}.page{padding-top:3.2mm}.top{height:68mm!important}.summary{margin-top:3mm!important}.table{margin-top:3mm!important}.notes{margin-top:3mm!important}</style></head>");
html = html.replace("<title>YCB Statement — Stage 1 Revised</title>", "<title>YCB Statement — Updated Unique Codes Preview</title>");
html = html.replace("fill=\"#172936\"", "fill=\"#2d3192\"");
await fs.writeFile(outputPath, html);
await fs.writeFile(new URL("preview/ycb-barcode-qr-payload.txt", root), qrPayload + "\n\nBARCODE\n" + barcodePayload + "\n");
console.log(`Wrote ${outputPath.pathname}`);
console.log(`QR characters: ${qrPayload.length}; barcode characters: ${barcodePayload.length}`);
console.log(`Distinct payloads: ${qrPayload !== barcodePayload}`);
