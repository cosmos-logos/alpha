#!/bin/bash

# Cosmos-Logos Commit Protocol: cleanthoughts-v1.sh
# Deletes all local branches except the main brain branch

brain_branch=$(git config user.brain)

if [ -z "$brain_branch" ]; then
  echo "Error: user.brain is not configured in your git settings."
  exit 1
fi

echo "Cleaning all branches except '$brain_branch'..."

git branch | grep -v "$brain_branch" | grep -v '\*' | xargs git branch -D