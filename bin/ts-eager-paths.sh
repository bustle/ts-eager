#!/bin/sh
exec node -r ts-eager/register-paths ${1+"$@"}
