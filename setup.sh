#!/bin/bash

# Mixpanel Minimal Setup Script
echo "🚀 Setting up Mixpanel Minimal..."

# Create necessary directories
echo "Creating directories..."
mkdir -p reports
mkdir -p dist
mkdir -p src/original
mkdir -p src/trimmed
mkdir -p src/analysis

# Install dependencies
echo "Installing dependencies..."
npm install

# Make tools executable
echo "Making tools executable..."
chmod +x tools/*.js

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your mixpanel.cjs.js file to src/original/"
echo "2. Edit methods-to-keep.json to specify which methods you use"
echo "3. Run: npm run trim"
echo "4. Run: npm run size"
echo ""
echo "See GETTING_STARTED.md for detailed instructions."