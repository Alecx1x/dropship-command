@echo off
title Dropship Command + Tunnel
cd /d "%~dp0"
rem Runs the PowerShell launcher, which starts the Cloudflare quick tunnel,
rem captures its (per-launch) URL, and starts the app + worker with AUTH_URL set
rem to that URL so login/redirects stay on the public URL instead of localhost.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-remote.ps1"
