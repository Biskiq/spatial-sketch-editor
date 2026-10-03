#!/usr/bin/env bash
# Current executable QA is owned beside the World prototype.
set -eu
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$HERE/../../../../../../prototypes/spatial-authoring/qa/run-all.sh" interaction
