#!/bin/bash
# SessionEnd hook: a háttérben újraépíti a vektoros indexet, hogy a kilépést ne tartsa fel.
# A VS Code-ból indított folyamat PATH-jában nem biztos, hogy benne van az nvm-es node.
dir="$(cd "$(dirname "$0")" && pwd)"
node_bin="$(command -v node)"
[ -n "$node_bin" ] || node_bin="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1)"
[ -n "$node_bin" ] || exit 0

root="$(cd "$dir/../.." && pwd)"
log_dir="$HOME/.claude/projects/$(printf '%s' "$root" | sed 's/[^a-zA-Z0-9]/-/g')/vectordb"
mkdir -p "$log_dir"
nohup "$node_bin" --disable-warning=ExperimentalWarning "$dir/vectordb.mjs" build >"$log_dir/build.log" 2>&1 </dev/null &
exit 0
