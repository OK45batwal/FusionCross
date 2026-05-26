#!/bin/bash

# ==============================================================================
# FusionCross DMG Packaging & Build Script
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RESET='\033[0m'

echo -e "${PURPLE}======================================================================${RESET}"
echo -e "${PURPLE}                  FUSIONCROSS DMG INSTALLER BUILDER                  ${RESET}"
echo -e "${PURPLE}======================================================================${RESET}"

# 1. Verification of environment
if [ "$(uname)" != "Darwin" ]; then
    echo -e "${RED}Error: Disk image creation is only supported on macOS systems.${RESET}"
    exit 1
fi

# Locate the compiled application bundle
APP_DIR="src-tauri/target/release/bundle/macos"
APP_NAME="FusionCross.app"
APP_PATH="${APP_DIR}/${APP_NAME}"

# Verify if tauri compilation exists, if not build it
if [ ! -d "$APP_PATH" ]; then
    echo -e "${BLUE}[1/4] Compiled bundle not found. Triggering cargo production build...${RESET}"
    npm run build
    npx tauri build --target release
fi

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: Failed to locate compiled application bundle at '${APP_PATH}'${RESET}"
    exit 1
fi

echo -e "${GREEN}✓ Located compiled application bundle at: ${APP_PATH}${RESET}"

# 2. Configure variables
DMG_TEMP_DIR="dist/dmg_temp"
DMG_OUT_DIR="dist"
DMG_NAME="FusionCross-Installer.dmg"
DMG_PATH="${DMG_OUT_DIR}/${DMG_NAME}"

# Clean old artifacts
rm -rf "$DMG_TEMP_DIR"
rm -f "$DMG_PATH"
mkdir -p "$DMG_TEMP_DIR"
mkdir -p "$DMG_OUT_DIR"

echo -e "${BLUE}[2/4] Initializing temporary staging workspace...${RESET}"
cp -R "$APP_PATH" "$DMG_TEMP_DIR/"
ln -s /Applications "$DMG_TEMP_DIR/Applications"

echo -e "${BLUE}[3/4] Creating HFS+ dynamic disk image via hdiutil...${RESET}"
# Create raw dynamic disk partition
hdiutil create -ov -volname "FusionCross Installer" -srcfolder "$DMG_TEMP_DIR" -fs HFS+ -format UDZO "$DMG_PATH"

echo -e "${GREEN}✓ Successfully created installer disk image: ${DMG_PATH}${RESET}"

# 3. Polish step
echo -e "${BLUE}[4/4] Finalizing and mounting diagnostics checks...${RESET}"
hdiutil imageinfo "$DMG_PATH" > /dev/null

echo -e "${PURPLE}======================================================================${RESET}"
echo -e "${GREEN}✓ FusionCross DMG Packaging completed successfully!${RESET}"
echo -e "${PURPLE}Output Installer Path: ${BLUE}${DMG_PATH}${RESET}"
echo -e "${PURPLE}======================================================================${RESET}"
