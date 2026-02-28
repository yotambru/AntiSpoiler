#!/bin/bash

# Script to prepare the extension for Chrome Web Store publishing

echo "🚀 Preparing the extension for Chrome Web Store..."

# Check that icons exist
if [ ! -f "icon16.png" ] || [ ! -f "icon48.png" ] || [ ! -f "icon128.png" ]; then
    echo "⚠️  Warning: Not all icon files found!"
    echo "   Create: icon16.png, icon48.png, icon128.png"
    echo "   Use create-icons.html or create-icons.py"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create temp directory
TEMP_DIR="temp-store-package"
rm -rf "$TEMP_DIR"
mkdir "$TEMP_DIR"

# Copy required files
echo "📦 Copying files..."
cp manifest.json "$TEMP_DIR/"
cp content.js "$TEMP_DIR/"
cp background.js "$TEMP_DIR/"
cp popup.html "$TEMP_DIR/"
cp popup.css "$TEMP_DIR/"
cp popup.js "$TEMP_DIR/"
cp game-notification.html "$TEMP_DIR/"
cp game-notification.js "$TEMP_DIR/"

# Copy icons if they exist
if [ -f "icon16.png" ]; then cp icon16.png "$TEMP_DIR/"; fi
if [ -f "icon48.png" ]; then cp icon48.png "$TEMP_DIR/"; fi
if [ -f "icon128.png" ]; then cp icon128.png "$TEMP_DIR/"; fi

# Create ZIP
ZIP_NAME="AntiSpoiler-extension-v$(grep '"version"' manifest.json | cut -d'"' -f4).zip"
echo "📦 Creating ZIP: $ZIP_NAME"
cd "$TEMP_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" > /dev/null
cd ..

# Cleanup
rm -rf "$TEMP_DIR"

echo "✅ Done!"
echo ""
echo "ZIP file ready: $ZIP_NAME"
echo ""
echo "Next steps:"
echo "1. Go to Chrome Web Store Developer Dashboard"
echo "2. Click 'New Item'"
echo "3. Upload the file: $ZIP_NAME"
echo "4. Fill in the details (see CHROME_STORE_GUIDE.md)"
echo ""
echo "💰 Remember: One-time $5 fee for developer registration"
