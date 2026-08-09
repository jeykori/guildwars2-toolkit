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

# # Build React (Browser) - Crucial to externalize react so it isn't bundled!
# bun build ./src/react/index.ts \
#   --outdir ./dist/react \
#   --format esm \
#   --target browser \
#   --external react

echo "📝 Generating TypeScript declarations..."
# Uses your tsconfig.json to map /src to /dist
bunx tsc --project tsconfig.build.json

echo "✅ Build complete!"