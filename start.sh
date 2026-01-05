#!/bin/bash

# Easy Start Script
# This script starts the development server

echo "🎬 Starting development server..."
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "Please run this script from the project directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the development server
echo "🚀 Starting development server..."
echo "The app will be available at http://localhost:5173"
echo ""

# Start npm in background
npm run dev &
NPM_PID=$!

echo "✅ Server is running (PID: $NPM_PID)"
echo "Press Ctrl+C to stop the server."
echo ""

# Wait for npm process
wait $NPM_PID

