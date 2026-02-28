# GitHub Secrets (for CI / publish)

To use **OVSX_PAT** (Open VSX / Cursor publish) in GitHub Actions or to have it documented for this repo:

## Add OVSX_PAT to this repo

1. Open the repo on GitHub: **https://github.com/saropa/saropa-log-capture**
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name:** `OVSX_PAT`  
   **Value:** your token from https://open-vsx.org/user-settings/tokens
5. Click **Add secret**

After that, any workflow can use it as `${{ secrets.OVSX_PAT }}`. Your local `.env` is still used when you run `python scripts/publish.py`; the GitHub secret is for automated or future workflows.
