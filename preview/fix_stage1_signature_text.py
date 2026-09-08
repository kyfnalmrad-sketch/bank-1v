from pathlib import Path

path = Path('/home/ubuntu/bank-karimi-web-staging/preview/ycb-official-certificate-preview.html')
html = path.read_text()
html = html.replace('with us under account number', 'account with us under account number')
html = html.replace('font-size:16pt;line-height:1.45;color:#151b29;min-height:27mm;min-width:0', 'font-size:14pt;line-height:1.45;color:#151b29;min-height:27mm;min-width:0')
html = html.replace('.signature .role,.signature .name{display:block;font-weight:700}.signature .name{font-weight:400;overflow-wrap:anywhere}', '.signature .role{display:block;font-weight:700;font-size:14pt}.signature .name{display:block;font-weight:400;font-size:14pt;white-space:nowrap;letter-spacing:-.2px}')
# Ensure field emphasis remains limited to the data spans in the statement.
html = html.replace('.body .strong{font-size:16pt;font-weight:700}', '.body .strong{font-size:16pt;font-weight:700}')
path.write_text(html)
print('fixed signature typography, wrapping, and account wording')
