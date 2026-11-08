#!/bin/zsh
cd "${0:A:h}"
worth_health="$(/usr/bin/curl -fsS --max-time 2 http://127.0.0.1:4318/health 2>/dev/null)"
if [[ -n "$worth_health" && "$worth_health" != *'"status":"failed"'* ]]; then
  /usr/bin/open http://127.0.0.1:4318/setup
  exit 0
fi
if /bin/launchctl kickstart -k "gui/$(id -u)/com.eros.youtubeworth" 2>/dev/null; then
  /usr/bin/open http://127.0.0.1:4318/setup
  exit 0
fi
worth_node="$(command -v node)"
if [[ -z "$worth_node" ]] || ! "$worth_node" --version >/dev/null 2>&1; then
  for worth_candidate in "$HOME"/.nvm/versions/node/*/bin/node(NOn); do
    if "$worth_candidate" --version >/dev/null 2>&1; then worth_node="$worth_candidate"; break; fi
  done
fi
if [[ -z "$worth_node" ]] || ! "$worth_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' >/dev/null 2>&1; then
  print 'Node.js 22 or newer is required.'
  read -r '?Press Enter to close…'
  exit 1
fi
WORTH_OPEN_SETUP=1 "$worth_node" server.mjs
