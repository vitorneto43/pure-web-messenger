#!/bin/bash

# WaveChat Version Increment Script
# Usage: ./increment-version.sh [major|minor|patch]
# Default: patch

set -e

GRADLE_FILE="android/app/build.gradle"
INCREMENT_TYPE="${1:-patch}"

# Check if gradle file exists
if [ ! -f "$GRADLE_FILE" ]; then
    echo "❌ Error: $GRADLE_FILE not found"
    exit 1
fi

# Read current versions
CURRENT_CODE=$(grep "versionCode" $GRADLE_FILE | grep -oE "[0-9]+$" | head -1)
CURRENT_NAME=$(grep "versionName" $GRADLE_FILE | grep -oE '"[^"]*"' | head -1 | tr -d '"')

if [ -z "$CURRENT_CODE" ] || [ -z "$CURRENT_NAME" ]; then
    echo "❌ Error: Could not read current versions from $GRADLE_FILE"
    exit 1
fi

# Calculate new versionCode (always increment by 1)
NEW_CODE=$((CURRENT_CODE + 1))

# Calculate new versionName based on type
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_NAME"

case "$INCREMENT_TYPE" in
    major)
        NEW_MAJOR=$((MAJOR + 1))
        NEW_MINOR=0
        NEW_PATCH=0
        NEW_NAME="$NEW_MAJOR.0.0"
        ;;
    minor)
        NEW_MAJOR=$MAJOR
        NEW_MINOR=$((MINOR + 1))
        NEW_PATCH=0
        NEW_NAME="$NEW_MAJOR.$NEW_MINOR.0"
        ;;
    patch|*)
        NEW_MAJOR=$MAJOR
        NEW_MINOR=$MINOR
        NEW_PATCH=$((PATCH + 1))
        NEW_NAME="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"
        ;;
esac

# Backup original file
cp "$GRADLE_FILE" "$GRADLE_FILE.bak"

# Update file
sed -i.tmp "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/g" "$GRADLE_FILE"
sed -i.tmp "s/versionName \"$CURRENT_NAME\"/versionName \"$NEW_NAME\"/g" "$GRADLE_FILE"
rm -f "$GRADLE_FILE.tmp"

# Verify changes
echo ""
echo "✅ Version incremented successfully!"
echo ""
echo "📊 Changes:"
echo "   versionCode: $CURRENT_CODE → $NEW_CODE"
echo "   versionName: $CURRENT_NAME → $NEW_NAME"
echo "   Type: $INCREMENT_TYPE"
echo ""

# Show updated lines
echo "📝 Updated content:"
grep -E "versionCode|versionName" "$GRADLE_FILE"
echo ""

# Ask for confirmation
read -p "Do you want to commit this change? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add "$GRADLE_FILE"
    git commit -m "chore: bump version to $NEW_NAME (versionCode: $NEW_CODE)"
    echo "✓ Committed to git"
else
    echo "⚠️  Changes not committed. Backup saved to $GRADLE_FILE.bak"
fi
