@echo off
set GIT="C:\Program Files\Git\bin\git.exe"
set GH="C:\Program Files\GitHub CLI\gh.exe"

echo Inicializando repositorio git...
%GIT% init
%GIT% config user.email "victor695538@gmail.com"
%GIT% config user.name "victor695538-hue"
%GIT% add .
%GIT% commit -m "JARVIS Server - Deploy inicial"

echo Creando repositorio en GitHub...
%GH% repo create jarvis-server --public --source=. --remote=origin --push

echo Listo! Repositorio subido a GitHub.
