#!/bin/bash
# Usage: bash push_to_github.sh <your-github-username> <repo-name>
# Example: bash push_to_github.sh johndoe fluoro-spectra-viewer

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <github-username> <repo-name>"
  exit 1
fi

USERNAME="$1"
REPO="$2"
REMOTE_URL="https://github.com/$USERNAME/$REPO.git"

# Initialize git if needed
git rev-parse --is-inside-work-tree 2>/dev/null || git init

git add .
git commit -m "Initial commit of fluorescent spectra viewer frontend" || echo "Nothing to commit (maybe already committed)"

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"
git push -u origin main

echo "Pushed to $REMOTE_URL"
