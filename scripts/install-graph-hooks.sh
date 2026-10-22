#!/bin/sh
# Instala os git hooks do graphify e acrescenta o passo que religa código→banco
# (scripts/graph-link-db.mjs) depois que o rebuild em background reescrever o graph.json.
# Idempotente: pode ser executado novamente após `graphify hook install`.
set -e
cd "$(git rev-parse --show-toplevel)"

graphify hook install

HOOKS_DIR="$(git rev-parse --git-path hooks)"
for hook in post-commit post-checkout post-merge post-rewrite; do
  file="$HOOKS_DIR/$hook"
  [ -f "$file" ] || continue
  if grep -q "# effort-db-link-start" "$file"; then
    continue
  fi
  cat >> "$file" <<'EOF'

# effort-db-link-start
# O rebuild do graphify descarta as arestas código→banco; reaplica quando o graph.json for reescrito.
if command -v node >/dev/null 2>&1 && [ -f scripts/graph-link-db.mjs ]; then
  (
    stamp="$(mktemp)"
    i=0
    while [ $i -lt 300 ]; do
      sleep 2
      i=$((i + 2))
      if [ graphify-out/graph.json -nt "$stamp" ] && ! grep -q '"supabase-linker"' graphify-out/graph.json; then
        sleep 1
        node scripts/graph-link-db.mjs >/dev/null 2>&1
        break
      fi
    done
    rm -f "$stamp"
  ) >/dev/null 2>&1 &
fi
# effort-db-link-end
EOF
  echo "$hook: passo graph-link-db adicionado"
done
