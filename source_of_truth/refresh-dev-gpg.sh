#!/bin/bash

set -e

echo "🧹 Cleaning up any corrupted smartcard configs..."

# Step 1: Ensure gpg-agent config is clean
cat > ~/.gnupg/gpg-agent.conf <<EOF
default-cache-ttl 600
max-cache-ttl 7200
pinentry-program /opt/homebrew/bin/pinentry-mac
EOF

chmod 600 ~/.gnupg/gpg-agent.conf

# Step 2: Kill agent and restart clean
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

# Step 3: Remove private key stubs (no real keys deleted)
echo "🧨 Deleting old smartcard references..."
rm -rf ~/.gnupg/private-keys-v1.d/*

# Step 4: Reimport your dev key (optional)
# Uncomment if needed:
# gpg --import ~/path/to/root@cosmos-logos.org-private.asc

# Step 5: Set git config to correct dev identity
echo "🔧 Setting Git config for dev..."
git config --global user.name "root-of-trust"
git config --global user.email "root@cosmos-logos.org"
git config --global user.signingkey A383736995101741
git config --global commit.gpgsign true
git config --global gpg.program $(which gpg)

echo "✅ Dev GPG environment reset. You are now signed in as root-of-trust."

# Step 6: Test it
echo "🧪 Testing GPG signing..."
echo "test-$(date)" > gpg-test.txt
git add gpg-test.txt
git commit -S -m "🧪 auto-signed test commit"