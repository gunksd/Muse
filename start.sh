#!/bin/bash
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
export NODE_TLS_REJECT_UNAUTHORIZED=0
pnpm start
