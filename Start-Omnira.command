#!/bin/bash
cd "$(dirname "$0")" || exit 1
if [ -x backend/.venv/bin/python ]; then
  exec backend/.venv/bin/python start.py "$@"
elif [ -x .venv/bin/python ]; then
  exec .venv/bin/python start.py "$@"
else
  exec python3 start.py "$@"
fi
