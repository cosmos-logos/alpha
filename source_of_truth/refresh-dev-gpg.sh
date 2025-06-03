#!/bin/bash

set -e

DEV_KEY_ID="5E8FA42E11C7294E"
DEV_EMAIL="root@cosmos-logos.org"
DEV_NAME="root-of-trust"
PINENTRY_PATH=$(which pinentry-mac || echo "/opt/homebrew/bin/pinentry-mac")
GPG=$(which gpg)

echo ""
echo "🔁 Starting Dev GPG Environment Refresh"
echo "--------------------------------------"

# 1. Check for valid GPG key
echo "🔍 Searching for dev key in GPG keyring..."
if ! $GPG --list-secret-keys --keyid-format LONG | grep -q "$DEV_KEY_ID"; then
  echo "❌ ERROR: GPG secret key $DEV_KEY_ID not found."
  echo "   💡 To recover, run:"
  echo "      gpg --import /path/to/your-private-key.asc"
  exit 1
fi
echo "✅ Found secret key: $DEV_KEY_ID"

# 2. Update gpg-agent config
echo ""
echo "🛠 Updating ~/.gnupg/gpg-agent.conf ..."
mkdir -p ~/.gnupg
cat > ~/.gnupg/gpg-agent.conf <<EOF
default-cache-ttl 600
max-cache-ttl 7200
pinentry-program $PINENTRY_PATH
EOF
chmod 600 ~/.gnupg/gpg-agent.conf
echo "✅ Config written."

# 3. Restart GPG agent
echo "♻️ Restarting gpg-agent..."
gpgconf --kill gpg-agent && echo "✅ gpg-agent killed"
gpgconf --launch gpg-agent && echo "✅ gpg-agent relaunched"

# 4. Configure Git locally (overwrite any agent config)
echo ""
echo "🔧 Reconfiguring .git/config for this repo..."
git config --local user.name "$DEV_NAME"
git config --local user.email "$DEV_EMAIL"
git config --local user.signingkey "$DEV_KEY_ID"
git config --local commit.gpgsign true
git config --local gpg.program "$GPG"

echo "✅ Git repo config:"
git config --local --list | grep -E 'user\.|commit\.|gpg\.'

# 5. Confirm environment
export GPG_TTY=$(tty)
echo ""
echo "🧪 Attempting dry-run signed commit..."
touch gpg-verify.txt
git add gpg-verify.txt
if git commit --dry-run -S -m "🧪 Dry-run signed commit" >/dev/null 2>&1; then
  echo "✅ GPG signing verified in local repo."
else
  echo "❌ Commit signing failed. Please recheck trust level or GPG key access."
  exit 1
fi

echo ""
echo "🎉 Dev Git + GPG environment fully restored and isolated from agent config."