#!/bin/bash

# Cosmos-Logos Commit Protocol: mainbrain-v1.sh
# Checks out the agent's configured primary neuralpathway

brain_branch=$(git config user.brain)

if [ -z "$brain_branch" ]; then
  echo "Error: user.brain is not set in your Git config."
  exit 1
fi

echo "Switching to brain: $brain_branch"
git checkout "$brain_branch"