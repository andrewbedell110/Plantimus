# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plantimus is a single-file static website (`index.html`) hosted on GitHub Pages at `https://andrewbedell110.github.io/Plantimus/`. It displays an AI plant companion with a live weather dashboard. There is no build step, package manager, or framework — everything runs in the browser directly.

## Deployment

Push to `master` and GitHub Pages auto-deploys within ~1 minute. No CI/CD pipeline.

## Architecture

The entire app lives in `index.html` with three logical sections:

**Layout** — Two-column flexbox: plant panel (left, takes remaining width) + weather panel (fixed 340px right sidebar).

**Plant display** — Time-based asset switching checked on load and every 60 seconds:
- 8am–6pm → `GIF/plant_breathing.gif`
- 6–8am and 6–8pm → `PNG/Yawn.png`
- 8pm–6am → `PNG/Sleep.png`

**Weather dashboard** — Fetches from OpenWeatherMap `/data/2.5/weather` on load and every hour. Sunrise/sunset are converted from UTC Unix timestamps using the API's `timezone` field (seconds offset from UTC) so they reflect the city's local time regardless of the viewer's browser timezone. The city is set via `const CITY = 'Sandy,UT,US'` near the top of the script block.

## Assets

- `GIF/` — animated GIFs (currently only `plant_breathing.gif`)
- `PNG/` — static plant expression images: `Sleep.png`, `Yawn.png`, `Happy.png`, `Wave.png`, `Talk.png`, `Wilt.png`, `Tilt.png`, `Jump.png`, `Cold.png`, `Hot.png`, `Water.png`, `Idea.png`, `Kiss.png`, `Showoff.png`, `Move_left.png`, `Move_right.png`, `Jelly_bean.png`

Not all PNG assets are currently used — they exist for future companion interaction features.

## API

OpenWeatherMap free tier (`/data/2.5/weather`). API key is hardcoded in `index.html`. Units are imperial (°F, mph).
