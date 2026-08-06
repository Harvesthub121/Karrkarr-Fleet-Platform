#!/usr/bin/env bash
# Dependency-free verification of the money-critical logic.
# Runs the interest engine, rounding, PayNow CRC and RBAC matrix tests using
# only Node's built-in test runner + native TypeScript type-stripping.
# Requires Node >= 22.6. No pnpm install needed — useful in a locked-down CI
# runner or during a security review of the billing rules.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src"
cp "$ROOT/packages/shared/src/"*.ts "$WORK/src/"
cp "$ROOT/packages/shared/verify.test.ts" "$WORK/"
echo '{"type":"module"}' > "$WORK/package.json"
# Node's ESM loader needs explicit extensions; the source omits them because
# NestJS and Next.js both use bundler resolution. Rewrite only in the copy.
sed -i -E "s#(from '\./[a-z-]+)'#\1.ts'#g" "$WORK/src/"*.ts
cd "$WORK" && node --test verify.test.ts
