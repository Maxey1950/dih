OurRevival Launcher (Windows x64)
=================================

Files
  RevivalLauncher.exe     the launcher (handles ourrevival:// links)
  launcher.example.json   example configuration (no secrets)
  SHA256SUMS.txt          checksums of the files above

This build may be UNSIGNED (development build). Windows SmartScreen will warn
about unsigned executables. Only run a build you obtained from the site's own
download page, and compare its SHA-256 with the value published there.

1. Install
   Put RevivalLauncher.exe in a folder you own that does not change, e.g.
     %LOCALAPPDATA%\Programs\OurRevival\RevivalLauncher.exe
   Do not run it from the Downloads folder or a network share.

2. Configure
   Copy launcher.example.json to
     %APPDATA%\OurRevival\launcher.json
   and set:
     apiBaseUrl     the site origin, https://... (no path)
     rfdExecutable  full path to your RFD player .exe, e.g. C:\RFD\RFD.exe
   The file holds no passwords or keys. The launcher only reads it.
   (RevivalLauncher.exe --config-path prints the location it uses.)

3. Register the ourrevival:// link handler (current user only, no admin):
     RevivalLauncher.exe --register
   This writes HKCU\Software\Classes\ourrevival with the command
     "<full path>\RevivalLauncher.exe" "%1"
   Run --register again if you move the .exe.

4. Play
   Press Play on a game page. The browser asks to open the link; the launcher
   exchanges the one-time ticket with the site and starts RFD.

Unregister / uninstall
     RevivalLauncher.exe --unregister
   then delete the .exe and %APPDATA%\OurRevival\launcher.json.
