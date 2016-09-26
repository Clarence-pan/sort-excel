@echo off

pushd %CD%

cd %~dp0/node_modules

mklink /d app ..\app
mklink /d client ..\client\src

popd
