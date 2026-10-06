@echo off
rem Opens the Plush Toy Box in its own Microsoft Edge app window (no address bar, own taskbar icon).
start "" msedge --app="%~dp0app\index.html" --window-size=1280,820
