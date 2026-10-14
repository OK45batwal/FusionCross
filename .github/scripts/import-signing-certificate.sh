#!/bin/bash
set -euo pipefail
# Runs only on the ephemeral GitHub-hosted release runner. Never echo secrets.
signing_keychain="$RUNNER_TEMP/fusioncross-signing.keychain-db"
signing_certificate="$RUNNER_TEMP/fusioncross-signing.p12"
signing_password="$(openssl rand -hex 32)"
printf '%s' "$APPLE_CERTIFICATE" | base64 --decode > "$signing_certificate"
security create-keychain -p "$signing_password" "$signing_keychain"
security set-keychain-settings -lut 21600 "$signing_keychain"
security unlock-keychain -p "$signing_password" "$signing_keychain"
security import "$signing_certificate" -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -t cert -f pkcs12 -k "$signing_keychain"
security list-keychains -d user -s "$signing_keychain" login.keychain-db
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$signing_password" "$signing_keychain"
security find-identity -v -p codesigning "$signing_keychain"
