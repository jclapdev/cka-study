#!/bin/sh
# The app for the situation tests, on port 5301: its own progress database, the stand-in lab from
# fake/, and its own Vite cache, so it never touches the learner's lab, progress or dev server.
set -e
dir=${CKA_SITUATIONS:?}
rm -rf "$dir"
mkdir -p "$dir"
cp "$(dirname "$0")/fake/lab.sh" "$dir/lab.sh"
chmod +x "$dir/lab.sh"
export CKA_DB="$dir/progress.db" CKA_LAB_FAKE="$dir" CKA_VITE_CACHE="$dir/vite"
exec pnpm exec react-router dev --port 5301
