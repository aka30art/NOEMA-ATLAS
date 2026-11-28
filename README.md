# NOEMA ATLAS

**Creative Intelligence & Prompt Ecosystem** — *Explore the unbuilt.*

A responsive, dependency-free static web app for the NOEMA ATLAS creative prompt ecosystem, styled in the approved dark Swiss / brutalist identity.

## Features
- Discover dashboard and 12 universal creative domains: ART, PHOTO, VIDEO, AGENTS, MATERIALS, TEXTURES, EFFECTS, 3D & OBJECTS, DESIGN, WORLDS, AUDIO and GENERATIVE SYSTEMS
- 50 published, searchable prompts across universal disciplines
- Six curated collections, including dedicated ANIME & CARTOON and TOYS & COLLECTIBLES specialist libraries
- Cross-category collection indexing: one prompt record can appear in multiple relevant collections
- Searchable and filterable prompt archive by domain, collection and tag
- Prompt detail dialog with copy and save actions
- Modular prompt builder with editable construction fields
- Collections, Materials Lab, Effects Lab, Style Systems, Photography, 3D / CG and Workflows
- Saved prompts and custom prompt vault using browser localStorage
- Responsive desktop, tablet and mobile layouts

## GitHub Pages deployment
1. Open repository **Settings → Pages**.
2. Select **GitHub Actions** as the build and deployment source.
3. Save. The included workflow builds and publishes the static app on pushes to `main` and manual workflow runs.

The workflow validates the app, uploads the Pages artifact and deploys it.

## Local preview
Run `python3 -m http.server 8080` from the repository root and visit `http://localhost:8080`. The app fetches its JSON catalogue over HTTP; opening `index.html` directly with `file://` is not supported.

## Project files
- `index.html` — application shell and screens
- `styles.css` — design tokens, layout and responsive components
- `app.js` — dataset loading, navigation, search, prompt builder and browser-local persistence
- `.github/workflows/deploy.yml` — GitHub Pages deployment

## Scope and data
This is the GitHub-only static catalogue release. Public catalogue content is versioned in Git. Saved data and custom prompts are stored only in the current browser. There is no authentication, cross-device sync, hosted database or external AI model execution yet. Do not put secrets or API keys in client-side code; those capabilities require a backend.

## Brand tokens
Ink `#0B0D0C` · Graphite `#191D1B` · Industrial `#292E2B` · Concrete `#777B77` · Off-white `#F0F0E9` · Acid Lime `#D6FF00`
