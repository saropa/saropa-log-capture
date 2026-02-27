# How to test this extension

**From Cursor, F5 does not work:** the Extension Development Host stays Cursor and the extension does not load.

**Do this instead:**

1. **Open this folder in VS Code.**  
   - Run the task **"Open workspace in VS Code"** (Terminal → Run Task…),  
   - or start VS Code yourself: **File → Open Folder** → `d:\src\saropa-log-capture`.

2. **In the VS Code window**, press **F5**.

A second window (VS Code Extension Development Host) will open with the extension loaded. Click the **Saropa Log Capture** icon on the left to open the viewer.

If `code` is not on your PATH, install VS Code from https://code.visualstudio.com/ and ensure “Add to PATH” was checked, or open the folder in VS Code manually.
