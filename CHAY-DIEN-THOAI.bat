@echo off
chcp 65001 >nul
title Thap Sang Ban Do - LIVE bang dien thoai
cd /d "%~dp0"
rem Giong CHAY.bat, them: dien thoai cung Wi-Fi mo duoc man hinh ban do (link hien o trang dieu khien, muc "Link OBS / dien thoai").
rem Trang dieu khien van chi mo duoc tren may nay. Tuong lua chan thi Windows hoi quyen quan tri -> bam "Co".
set TSBD_LAN=1
set "TSBD_NODE="
if exist "%~dp0node.exe" set "TSBD_NODE=%~dp0node.exe"
if not defined TSBD_NODE for /f "delims=" %%i in ('where node 2^>nul') do if not defined TSBD_NODE set "TSBD_NODE=%%i"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\mo-tuong-lua.ps1" -Port 3002 -Program "%TSBD_NODE%" -Check
if errorlevel 2 (
  echo Tuong lua Windows dang chan cong 3002 - Windows se hoi quyen quan tri, bam "Co" de dien thoai mo duoc.
  powershell -NoProfile -Command "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0tools\mo-tuong-lua.ps1\" -Port 3002 -Program \"%TSBD_NODE%\"'"
)
call CHAY.bat
