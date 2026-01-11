# Contributing to Jellyflow

Thanks for taking the time to contribute. This project is a React + Vite app, so changes are
usually focused on `src/App.jsx`, `src/styles.css`, and the modules in `src/modules/`.

## Setup
- Install dependencies: `npm install`
- Run the app: `npm run dev` (serves at `http://localhost:3000`)
- Production build: `npm run build` and `npm run preview`

## Project Structure
- `index.html`: Vite entry shell.
- `src/App.jsx`: main markup and UI skeleton.
- `src/styles.css`: global theme, layout, and animations.
- `src/app/initApp.js`: module entry point and event wiring.
- `src/modules/`: feature modules for API, coverflow, lyrics, playlists, and playback.

## Coding Style
- Use 2-space indentation and double quotes in JavaScript.
- Prefer `const`/`let`; avoid `var`.
- Keep DOM IDs camelCase and match them in `src/app/initApp.js`.
- CSS uses kebab-case for classes and custom properties.

## Testing
There are no automated tests yet. Please do a quick manual pass:
- Connect to Jellyfin, load albums, and play a track.
- Open/close lyrics and playlists panels.
- Verify keyboard navigation (arrows, enter, space).

## Pull Requests
- Keep PRs focused and describe the change and why it matters.
- Include steps to verify and screenshots or GIFs for UI changes.

See `AGENTS.md` for repository-specific contributor tips.
