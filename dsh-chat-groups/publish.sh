#!/bin/sh
set -eu

case "$#:${1-}" in
  0:|1:--dry-run) ;;
  *)
    printf 'Usage: %s [--dry-run]\n' "$0" >&2
    exit 2
    ;;
esac

cd "$(dirname "$0")"

npm test
if [ "$#" -eq 1 ]; then
  exec npm pack --dry-run
fi

exec npm publish --access public --tag next --registry=https://registry.npmjs.org
