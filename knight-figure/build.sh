#!/bin/sh
# Join the sections into one standalone HTML file. The sculpt core is embedded a
# second time as plain text so Web Workers can be started from it (no eval).
D=$(dirname "$0")
OUT=${1:-$D/index.html}
{
  cat "$D/src/00-head.html"
  echo '<script type="text/plain" id="coreSrc">'
  cat "$D/src/10-math.js" "$D/src/20-sdf.js" "$D/src/30-sculpt.js" "$D/src/40-mesher.js"
  echo '</script>'
  echo '<script>'
  for f in "$D"/src/*.js; do cat "$f"; echo; done
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"
