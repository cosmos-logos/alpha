#!/bin/bash

# Cosmos-Logos Commit Protocol: newthought-v1.sh
# Creates a new timestamped branch for a thought/neuralpathway

base=$(git merge-base HEAD $(git config user.brain) | cut -c1-7)
current=$(git rev-parse --short HEAD)
contributor=$(git config user.username | tr ' ' '_')
username=$(git config user.username)
label="$1"
sanitized_label=$(echo "$label" | tr ' ' '-' | tr -d '()')

if [ "$base" = "$current" ]; then
  current=$(git rev-parse HEAD | cut -c8-14)
fi

if [ -n "$sanitized_label" ]; then
  git checkout -b "@$contributor/neuralpathway/$base-$current-$(date +%Y%m%d%H%M%S)-$sanitized_label"
else
  git checkout -b "@$contributor/neuralpathway/$base-$current-$(date +%Y%m%d%H%M%S)"
fi