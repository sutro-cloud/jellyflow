# Jellyflow

A modern, coverflow-inspired Jellyfin music browser and player built with React + Vite.

## Requirements

- Node.js 18+
- A Jellyfin server with music library access

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open the app:

   - http://localhost:3000

## Production build

```bash
npm run build
npm run preview
```

## Connect to Jellyfin

1. Click **Connect**.
2. Enter your Jellyfin server URL, username, and password.
3. Save & connect.
4. Optional: expand **Use API key instead** to authenticate with an API key and user ID.

## Notes

- If your Jellyfin server blocks requests from this origin, enable CORS for `http://localhost:3000` in Jellyfin or your reverse proxy.
- Album art and audio stream directly from your Jellyfin server using your API key.
- Optional: enable “Fetch lyrics from LRCLIB (online)” in the connection dialog to load lyrics on the fly.

## Contributing

See `CONTRIBUTING.md` and `AGENTS.md` for setup, style, and PR expectations.
