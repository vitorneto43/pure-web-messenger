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

EXPECTED_APPLICATION_ID="com.wavechat.app"


if [ -z "$ANDROID_KEYSTORE_FILE" ] || [ -z "$ANDROID_KEYSTORE_PASSWORD" ] || [ -z "$ANDROID_KEY_ALIAS" ] || [ -z "$ANDROID_KEY_PASSWORD" ]; then
    echo "❌ Signing credentials missing."
    echo "   Required: ANDROID_KEYSTORE_FILE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD"
    exit 1
fi

ACTUAL_SHA1=$(keytool -list -v -keystore "$ANDROID_KEYSTORE_FILE" \
    -alias "$ANDROID_KEY_ALIAS" \
    -storepass "$ANDROID_KEYSTORE_PASSWORD" \
    | awk -F': ' '/SHA1:/{print $2; exit}')

echo "📋 Keystore SHA-1: $ACTUAL_SHA1"


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
    echo "✅ Package name kept as: $EXPECTED_APPLICATION_ID"
    echo "✅ Upload Key SHA-1 validated: $EXPECTED_UPLOAD_SHA1"
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
