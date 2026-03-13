# Share Investigation

Share an investigation so teammates can open it in VS Code (read-only). Options: GitHub Gist, export as .slc file, **Copy deep link (local file)**, LAN server, upload to URL, or save to a shared folder.

- **Copy deep link (local file):** Export to a .slc file (you choose the path), then copy a `vscode://…/import?url=file:///…` link so others can open that file in VS Code (they need access to the same path or a copy of the file).
- **Import from URL** supports `https`, same-network `http` (e.g. `http://192.168.1.5:port/investigation.slc`), and `file://` URLs for a local .slc file.

## Deleting shared Gists (expiration)

Secret Gists created by **Share via GitHub Gist** do **not** expire. To remove a share:

1. Open the Gist in your browser (use **Open Gist** after sharing, or open from **Recent shares**).
2. Click **Delete** (trash icon) on the gist page.
3. The share link will stop working; anyone who already imported the investigation still has a local copy.

To manage multiple shares: open [Your Gists](https://gist.github.com/) and delete any **Saropa Investigation** gists you no longer need.
