#!/bin/bash

# ========================================================
# FusionWine Build & Verification Script
# ========================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0;30m' # No Color
RESET='\033[0m'

echo -e "${PURPLE}====================================================${RESET}"
echo -e "${PURPLE}           FUSIONWINE COMPILATION RUNNER            ${RESET}"
echo -e "${PURPLE}====================================================${RESET}"

echo -e "\n${BLUE}[1/3] Validating system parameters...${RESET}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed on this host.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node -v)${RESET}"

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust (Cargo) is not installed on this host.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Rust (Cargo) version: $(cargo --version)${RESET}"

echo -e "\n${BLUE}[2/3] Installing frontend dependencies...${RESET}"
npm install

echo -e "\n${BLUE}[3/3] Compiling TypeScript & building React bundle...${RESET}"
npm run build

echo -e "\n${GREEN}✓ Build validation completed successfully!${RESET}"
echo -e "${PURPLE}To launch the premium desktop app wrapper, execute:${RESET}"
echo -e "   ${BLUE}npm run dev${RESET}        (to run the Vite development server)"
echo -e "   ${BLUE}npm run tauri dev${RESET}  (to launch the native macOS app shell)"
echo -e "${PURPLE}====================================================${RESET}"
