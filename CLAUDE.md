# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies using the committed `package-lock.json`.
- `npm run dev` — start the Vite dev server on `127.0.0.1`; the Bangumi API proxy is active in this mode.
- `npm run build` — build the static app into `dist/`.
- `npm run preview` — serve the production build on `127.0.0.1`; the same Bangumi proxy middleware is active in preview.
- No lint or test scripts are currently configured in `package.json`, so there is no project-provided single-test command yet.

## Runtime and dependencies

- This is a vanilla Vite app using browser ES modules; there is no frontend framework or router.
- `package.json` has Vite as the only dev dependency. The lockfile currently resolves Vite 8.x, which requires Node `^20.19.0 || >=22.12.0`.
- The app uses `fetch`, `localStorage`, and DOM APIs directly in `src/main.js`.

## Architecture overview

- `index.html` is the static Chinese UI shell. Its radio inputs use `name="subject-type"` and values `anime`, `book`, and `drama`; its element IDs are queried directly from `src/main.js`, so keep markup values and JS selectors in sync.
- `src/main.js` owns all client state and data flow. `SUBJECT_TYPES` maps UI choices to Bangumi subject types (`anime` = 2, `book` = 1, `drama` = 6), display labels, cover requirements, and initial fetch sizes.
- Random recommendations are queue-based. `loadRandomSubject()` renders from the per-type queue when possible; otherwise it fetches an initial random page, renders one item, and starts `refillQueue()` in the background. Queues and total counts are cached in `localStorage` for 24 hours.
- Bangumi data is requested from the browser via `/api/bangumi/subjects` with `type`, `sort=date`, `limit`, and `offset` query parameters. `fetchRandomSubjectsPage()` samples random offsets and filters by subject type, required cover images, and duplicate/last-seen IDs.
- `vite.config.js` defines the `bangumi-api-proxy` middleware for both dev and preview servers. It forwards `GET /api/bangumi/subjects` to `https://api.bgm.tv/v0/subjects` and `POST /api/bangumi/search/subjects` to `https://api.bgm.tv/v0/search/subjects`, adding the `user-agent: uerax/NaniAnime` header.
- The proxy is a Vite server feature, not part of the static `dist/` output. Deployments that serve only `dist/` need an equivalent `/api/bangumi/...` backend/proxy route.
- `src/style.css` is global CSS for the single-page card layout; class names correspond directly to the markup in `index.html`.
