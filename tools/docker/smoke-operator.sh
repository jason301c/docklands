#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

DOCKLANDS_SMOKE_OPERATOR=1 exec "$SCRIPT_DIR/smoke-image.sh" "$@"
