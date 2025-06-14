#!/bin/bash
echo "🔧 Installiere Abhängigkeiten mit legacy-peer-deps"
npm install --legacy-peer-deps

echo "🚀 Baue Projekt"
npm run build
