#!/bin/sh
# Genera los clips de voz de respaldo para la pantalla de TV (navegadores sin speechSynthesis).
# Requiere macOS (comando `say`). Uso: sh frontend/scripts/generate-voice-clips.sh
set -e

VOICE="${VOICE:-Mónica}"
RATE="${RATE:-165}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio/voz"
mkdir -p "$OUT"

clip() {
  say -v "$VOICE" -r "$RATE" -o "$OUT/$1.wav" --data-format=LEI16@22050 "$2"
}

clip turno "Turno"
clip segunda "Segunda llamada para el turno"
clip tercera "Tercera llamada para el turno"
clip llamada "Llamada para el turno"
clip ventanilla "diríjase a la ventanilla"
clip silencio "[[slnc 200]]"

set -- a:a b:be c:ce d:de e:e f:efe g:ge h:hache i:i j:jota k:ka l:ele m:eme n:ene \
  o:o p:pe q:cu r:erre s:ese t:te u:u v:uve w:"uve doble" x:equis y:ye z:zeta
for pair in "$@"; do
  clip "letra-${pair%%:*}" "${pair#*:}"
done

UNITS="cero uno dos tres cuatro cinco seis siete ocho nueve"
TEENS="diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve"
TENS="x x veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa"

i=0; for w in $UNITS; do clip "n$i" "$w"; i=$((i + 1)); done
i=10; for w in $TEENS; do clip "n$i" "$w"; i=$((i + 1)); done
t=0
for tw in $TENS; do
  if [ "$t" -ge 2 ]; then
    u=0
    for uw in $UNITS; do
      if [ "$u" -eq 0 ]; then clip "n$((t * 10))" "$tw"; else clip "n$((t * 10 + u))" "$tw y $uw"; fi
      u=$((u + 1))
    done
  fi
  t=$((t + 1))
done

clip cien "cien"
h=1
for hw in ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos; do
  clip "h$h" "$hw"; h=$((h + 1))
done

echo "Clips generados en $OUT"
