#!/bin/bash

# Raindrop Video Summarizer - Convenient runner script
# This script eliminates the need to type --allow-all every time

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install from https://deno.land/"
    exit 1
fi

# Run the application with all arguments passed through
exec deno run --allow-all main.ts "$@"