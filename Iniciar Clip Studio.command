#!/bin/zsh -l
cd "${0:A:h}"
for tool in node ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta $tool. Instálalo y vuelve a abrir Clip Studio."
    read -k 1
    exit 1
  fi
done
if [[ ! -d node_modules ]]; then
  echo "Instalando dependencias de la vista previa..."
  npm ci || exit 1
fi
port=4173
while lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; do
  ((port++))
done
export PORT=$port
echo "Clip Studio: http://127.0.0.1:$PORT · Ctrl+C para cerrar."
exec npm start
