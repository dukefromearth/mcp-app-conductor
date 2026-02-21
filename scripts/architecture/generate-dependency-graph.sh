#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT_DIR/tools/dependency-cruiser/depcruise.config.cjs"
OUTPUT_DIR="$ROOT_DIR/docs/architecture/graphs"
OUTPUT_FILE="$OUTPUT_DIR/dependency-graph.mmd"
COLLAPSE_PATTERN='^packages/[^/]+|^examples/proving-ground/(?:scenarios|scripts)'

mkdir -p "$OUTPUT_DIR"

pnpm exec depcruise \
  --config "$CONFIG" \
  --collapse "$COLLAPSE_PATTERN" \
  --output-type mermaid \
  --output-to "$OUTPUT_FILE" \
  "$ROOT_DIR/packages" \
  "$ROOT_DIR/examples/proving-ground"

echo "Generated: $OUTPUT_FILE"
