#!/bin/bash

# Cosmos-Logos Commit Protocol: saveall-v1.sh
# Stages all changes, then performs a Cosmos-Logos-compliant signed commit

if [ -z "$1" ]; then
  echo "Usage: ./saveall-v1.sh <thought-label>"
  exit 1
fi

git add .
./savethought-v1.sh "$1"