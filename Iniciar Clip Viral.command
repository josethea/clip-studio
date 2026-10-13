#!/bin/zsh -l
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instálalo y vuelve a abrir esta app."
  read -k 1
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "No se encontró FFmpeg o ffprobe en PATH."
  read -k 1
  exit 1
fi
echo "Abre http://127.0.0.1:4173 en tu navegador. Pulsa Ctrl+C para cerrar."
exec node server.mjs
