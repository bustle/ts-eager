#!/bin/sh
# deprecated: ts-eager detects paths presence automatically now
exec node -r ts-eager/register-paths ${1+"$@"}
