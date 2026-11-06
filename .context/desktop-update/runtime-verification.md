# Desktop update and OpenRouter runtime check

Verified against the workspace dev build on 2026-11-06 at `http://localhost:5173/windows/main/index.html`.

## Forced update

The app opens directly to Compare, with a full-window dark overlay above the page. It shows the OTT24x7 AI logo, “Update required,” the fixture notes, “Update now,” and “Download in browser.” The close control is absent, and the renderer DOM confirms the overlay text is present with no error alert after a clean reload. The main process serves build 3 with minimum build 3 against desktop build 2, so the decision is forced. I did not start an installer or open the external link.

## Optional update and OpenRouter popup

With the optional fixture (build 3, minimum 2), the dialog showed “Update available · v2.1.11”, the release notes, “Update now”, and “Later.” After selecting Later, the OpenRouter popup appeared while Compare remained in the page. It showed a `password` input with `autocomplete="new-password"`, a “Get a free key” link to `https://openrouter.ai/keys`, “Check & fetch free models”, “Don’t show again”, and “Not now.” The DOM had no alerts. No key was entered, no installer was started, and the link was not opened.

## Normal-manifest launch

After fixture checks, I relaunched without `OTT_UPDATE_MANIFEST_URL`. The app opens directly to Compare with the optional OpenRouter popup because this isolated dev profile has no OpenRouter key; no update dialog is shown. The workspace instance remains running for continued development.
