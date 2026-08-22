@echo off
set GIT=git
set GH=gh

echo Guardando cambios...
%GIT% add .

echo Creando commit...
%GIT% commit -m "feat: vision model auto-routing, websocket agent, and web UI"

echo Subiendo a GitHub...
%GIT% push origin main

echo Done! Render desplegara los cambios automaticamente.
