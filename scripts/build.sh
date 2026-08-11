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

echo "📝 Generating TypeScript declarations..."
# Uses your tsconfig.json to map /src to /dist
bunx tsc --project tsconfig.build.utils.json
bunx tsc --project tsconfig.build.ui.json

echo "✅ Build complete!"