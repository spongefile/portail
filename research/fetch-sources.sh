#!/usr/bin/env bash
#
# fetch-sources.sh — download the vendor sources this project analyses.
#
# None of eowave's material is redistributed in this repository. It is fetched
# on demand into research/, which is gitignored, and analysed locally for
# interoperability. Run this once before `node research/extract-model.js`.
#
#   ./research/fetch-sources.sh
#
# Downloads (~600 KB total):
#   research/original-editor/    the official web editor (HTML + JS + CSS)
#   research/portail-manual.pdf  the official manual, V0.9
#   research/firmware/           the official firmware image (.uf2 + raw .bin)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$ROOT/research"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
EDITOR_BASE='https://www.eowave.app/portail'
MANUAL_ID='1f-CBGsoNcTpe_blxI6dH2XDuSmyQyvuR'

get() { # get <url> <dest>
  mkdir -p "$(dirname "$2")"
  if curl -fsSL -A "$UA" "$1" -o "$2"; then
    printf '  ok   %-46s %s bytes\n' "${2#"$ROOT"/}" "$(wc -c <"$2" | tr -d ' ')"
  else
    printf '  FAIL %s\n' "${2#"$ROOT"/}" >&2
    return 1
  fi
}

echo "==> Official editor"
get "$EDITOR_BASE/"             "$R/original-editor/index.html"
get "$EDITOR_BASE/mystyle.css"  "$R/original-editor/mystyle.css"
for f in FileSaver about file menu midi mod_matrix notes; do
  get "$EDITOR_BASE/js/$f.js"   "$R/original-editor/js/$f.js"
done

# The editor's SysEx handlers live in an inline <script> in index.html, so the
# extractor needs them pulled out into a file of their own.
python3 - "$R/original-editor" <<'PY'
import re, sys, pathlib
d = pathlib.Path(sys.argv[1])
html = (d / 'index.html').read_text(encoding='utf-8', errors='replace')
scripts = re.findall(r'(?is)<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html)
out = '\n\n/* ---- next inline script ---- */\n\n'.join(scripts)
(d / 'inline-script.js').write_text(out)
print(f'  ok   research/original-editor/inline-script.js{" " * 12} {len(out)} bytes')
PY

echo "==> Official manual (V0.9)"
get "https://drive.google.com/uc?export=download&id=$MANUAL_ID" "$R/portail-manual.pdf"
if python3 -c 'import pypdf' 2>/dev/null; then
  python3 - "$R" <<'PY'
import re, sys, pathlib
from pypdf import PdfReader
r = pathlib.Path(sys.argv[1])
t = '\n'.join((p.extract_text() or '') for p in PdfReader(r / 'portail-manual.pdf').pages)
t = re.sub(r'[ \t]*\n[ \t]*', ' ', t)
t = re.sub(r' {2,}', ' ', t)
t = re.sub(r'(?<=[.:!?]) (?=[A-Z])', '\n', t)
(r / 'portail-manual.txt').write_text(t)
print(f'  ok   research/portail-manual.txt{" " * 22} {len(t)} bytes')
PY
else
  echo "  skip research/portail-manual.txt (pip3 install pypdf to extract text)"
fi

echo "==> Official firmware"
get "https://eowave.app/portail/usb-cv_3.uf2" "$R/firmware/usb-cv_3.uf2"
python3 - "$R/firmware" <<'PY'
import struct, sys, pathlib
d = pathlib.Path(sys.argv[1])
data = (d / 'usb-cv_3.uf2').read_bytes()
out, n = bytearray(), 0
for i in range(0, len(data), 512):
    b = data[i:i + 512]
    if len(b) < 512:
        break
    magic, _, _, _, plen, *_ = struct.unpack('<8I', b[:32])
    if magic != 0x0A324655:      # UF2 first magic
        continue
    out += b[32:32 + plen]
    n += 1
(d / 'firmware.bin').write_bytes(out)
print(f'  ok   research/firmware/firmware.bin{" " * 18} {len(out)} bytes ({n} UF2 blocks)')
PY
strings -n 4 "$R/firmware/firmware.bin" | sort -u > "$R/firmware/strings.txt"
printf '  ok   research/firmware/strings.txt%18s %s lines\n' '' "$(wc -l <"$R/firmware/strings.txt" | tr -d ' ')"

cat <<'EOF'

Done. Next:
  node research/extract-model.js      regenerate spec/model.json
  python3 research/fw-analyse.py      disassemble the firmware SysEx parser

These files are gitignored and must not be committed — they are eowave's
copyrighted material, kept locally for interoperability analysis only.
EOF
