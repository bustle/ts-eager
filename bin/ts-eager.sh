#!/bin/sh
exec node -r ts-eager/register ${1+"$@"}
