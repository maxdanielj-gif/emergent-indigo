#!/bin/bash
cd /app
export PORT=3000
export NODE_ENV=development
exec node_modules/.bin/tsx server.ts
