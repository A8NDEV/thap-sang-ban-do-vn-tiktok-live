@echo off
chcp 65001 >nul
title Thap Sang Ban Do Viet Nam
cd /d "%~dp0"
rem Ban mang di co san node.exe ben canh -> may khach khong can cai Node. Ban ma nguon dung node da cai.
set "NODE=node"
if exist "%~dp0node.exe" set "NODE=%~dp0node.exe"
if not exist node_modules (echo Dang cai thu vien lan dau... & call npm install --omit=dev)
rem Mo bang dieu khien khi server san sang - chi mo 1 lan
start "" /b "%NODE%" scripts\open-control.mjs
:loop
"%NODE%" server.mjs
rem Ma 77 = tat han (dong tab bang dieu khien / mo ban moi) -> dong cua so, khong chay lai
if "%errorlevel%"=="77" exit
echo Server dung, khoi dong lai sau 2 giay... (dong cua so nay de tat)
timeout /t 2 >nul
goto loop
