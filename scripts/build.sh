#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

echo "🧹 Cleaning dist folder..."
rm -rf dist

echo "⚡ Building JavaScript with Bun..."

# Build Utils (Node/Isomorphic)
bun build ./src/utils/index.ts \
  --outdir ./dist/utils \
  --format esm \
  --target node

# Build React (Browser)
bun build ./src/ui/index.ts \
  --outdir ./dist/ui \
  --format esm \
  --target browser \
  --external react \
  --external react-dom \
  --external react/jsx-runtime

echo "📝 Generating Backend TypeScript declarations..."
bunx tsc --project tsconfig.build.utils.json
echo "📝 Generating UI TypeScript declarations..."
bunx tsc --project tsconfig.build.ui.json

echo "✅ Build complete!"