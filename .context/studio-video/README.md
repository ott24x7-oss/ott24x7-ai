# Studio video local mock

Run the local API mock from the app root:

```powershell
node .context/studio-video/mockServer.mjs
```

In a second terminal, start the app with the isolated development profile:

```powershell
$env:CS_DEV_USER_DATA_SUFFIX = 'OTT24x7AIDev'
pnpm debug
```

Configure a local test provider with base URL `http://127.0.0.1:8788/v1` and the `grok-imagine-video` model. A placeholder credential such as `local-mock-only` is enough; the mock does not validate or log it. No real API key or paid request is used.

The mock completes a job through `queued → in_progress → completed`, serves the repository's small MP4 fixture, and returns `prompt_blocked` for a prompt containing `[mock-fail]`. Set `VIDEO_MOCK_STYLE=task` or `VIDEO_MOCK_STYLE=openai` before starting the server to make the other submission route return 404/405 and exercise fallback. It listens on loopback only.
