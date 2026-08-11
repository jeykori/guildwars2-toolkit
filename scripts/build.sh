#!/usr/bin/env bash
set -e

echo "🧹 Cleaning dist folder..."
rm -rf dist

echo "⚡ Building JavaScript with Bun..."

# Build Utils
bun build ./src/utils/index.ts \
  --production \
  --outdir ./dist/utils \
  --format esm \
  --target node

# Build React (Browser)
bun build ./src/ui/index.ts \
  --production \
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