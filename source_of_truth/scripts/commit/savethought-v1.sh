#!/bin/bash

# Cosmos-Logos Commit Protocol: savethought-v1.sh
# Stages, signs, and pushes a timestamped, labeled commit

username=$(git config user.username)
label="$1"
sanitized_label=$(echo "$label" | tr ' ' '-' | tr -d '()')

if [ -n "$sanitized_label" ]; then
  git commit -S -m "@$username:thought/$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)-$sanitized_label"
else
  git commit -S -m "@$username:thought/$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
fi

git push --set-upstream origin $(git rev-parse --abbrev-ref HEAD)