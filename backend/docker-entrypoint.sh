#!/bin/sh
set -e

# Start socat proxy for IPv6->localhost relay if needed
# socat TCP4-LISTEN:5432,reuseaddr,fork TCP6:[2600:1f16:1cd0:3330:35b4:c919:d44f:1a74]:5432 &

# Run the main command
exec "$@"
