#!/bin/bash

# WaveChat AAB Build Script
# This script generates a signed Android App Bundle (AAB) for Google Play Console

set -e

echo "🔨 WaveChat - AAB Build Script"
echo "================================"

# Check if we're in the right directory
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: capacitor.config.ts not found. Please run this script from the project root."
    exit 1
fi

# Check if Android SDK is installed
if [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "⚠️  Warning: ANDROID_SDK_ROOT not set. Trying to find Android SDK..."
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
    else
        echo "❌ Error: Android SDK not found. Please set ANDROID_SDK_ROOT environment variable."
        exit 1
    fi
fi

echo "✓ Android SDK: $ANDROID_SDK_ROOT"

# Check if keystore environment variables are set
if [ -z "$ANDROID_KEYSTORE_FILE" ] || [ -z "$ANDROID_KEYSTORE_PASSWORD" ] || [ -z "$ANDROID_KEY_ALIAS" ] || [ -z "$ANDROID_KEY_PASSWORD" ]; then
    echo ""
    echo "⚠️  Warning: Signing credentials not found in environment variables."
    echo "   Set the following to use a production keystore:"
    echo "   - ANDROID_KEYSTORE_FILE"
    echo "   - ANDROID_KEYSTORE_PASSWORD"
    echo "   - ANDROID_KEY_ALIAS"
    echo "   - ANDROID_KEY_PASSWORD"
    echo ""
    echo "   Using development keystore for now..."
fi

# Build the AAB
echo ""
echo "📦 Building Android App Bundle (AAB)..."
cd android
./gradlew bundleRelease

# Check if build was successful
if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
    echo ""
    echo "✅ AAB build successful!"
    echo "📍 Location: android/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "Next steps:"
    echo "1. Upload to Google Play Console"
    echo "2. Configure release notes and screenshots"
    echo "3. Submit for review"
else
    echo "❌ AAB build failed. Check the error messages above."
    exit 1
fi

cd ..
