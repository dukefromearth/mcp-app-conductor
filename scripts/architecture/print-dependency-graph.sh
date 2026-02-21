#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT_DIR/tools/dependency-cruiser/depcruise.config.cjs"
COLLAPSE_PATTERN='^packages/[^/]+|^examples/proving-ground/(?:scenarios|scripts)'

pnpm exec depcruise \
  --config "$CONFIG" \
  --collapse "$COLLAPSE_PATTERN" \
  --output-type mermaid \
  "$ROOT_DIR/packages" \
  "$ROOT_DIR/examples/proving-ground"
