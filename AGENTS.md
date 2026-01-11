# Repository Guidelines

## Project Structure & Module Organization
This is a React + Vite app with feature modules. Key files:
- `index.html` is the Vite entry shell.
- `src/App.jsx` holds the app markup and UI skeleton.
- `src/app/initApp.js` wires event listeners and bootstraps behavior.
- `src/modules/` contains feature-focused ES modules (coverflow, lyrics, playlists, playback).
- `src/styles.css` contains the global theme, layout, and animations.
- `package.json` defines scripts and dependencies.

## Build, Test, and Development Commands
- `npm install` installs React/Vite dependencies.
- `npm run dev` starts the Vite dev server at `http://localhost:3000`.
- `npm run build` outputs the production build to `dist/`.
- `npm run preview` serves the production build locally.

## Coding Style & Naming Conventions
- Indentation is 2 spaces; use semicolons and double quotes in JavaScript.
- Prefer `const` and `let`; avoid `var`.
- DOM element IDs in `src/App.jsx` are camelCase and mirrored in `src/app/initApp.js`.
- CSS classes and custom properties use kebab-case (example: `.coverflow-section`, `--panel-veil`).

## Testing Guidelines
There is no automated test framework or coverage target yet.
Manual checks should include connecting to a Jellyfin server, browsing albums, starting playback,
and toggling theme/lyrics options to verify UI state transitions.

## Commit & Pull Request Guidelines
Git history currently has a single "initial commit", so no convention is established.
Use short, imperative commit subjects and add a brief body when behavior changes.
For pull requests, include a clear summary, steps to verify, and screenshots or GIFs for UI updates.

## Configuration & Security Tips
- Requires Node 18+ and a reachable Jellyfin server.
- Change ports via `vite.config.js` if needed.
- Do not commit Jellyfin credentials or API keys; they are stored locally in the browser.
- If the Jellyfin server blocks the app, enable CORS for `http://localhost:3000`.
