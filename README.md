# APEX // TELEMETRY

A live, auto-updating Formula 1 command center with a sci-fi HUD aesthetic. Built with Next.js for one-click Vercel deployment.

![status](https://img.shields.io/badge/data-live-00f0ff) ![framework](https://img.shields.io/badge/next.js-14-black)

## What's inside

- **Ignition boot sequence** — five red lights, then lights out
- **Race countdown hero** — next Grand Prix with full weekend session schedule in your local time
- **Live timing tower** — positions, gap to leader, intervals, current tire compound + tire age, updated every 30 s during sessions (OpenF1)
- **Race control feed** — flags, safety cars, FIA messages during live sessions
- **Drivers' Championship & Constructors' Cup** — animated team-color bars (Jolpica/FIA classification)
- **Season calendar** — all rounds, done/next markers
- **Last race intel** — podium, full classification with grid-delta, fastest lap, race weather (air/track temp, humidity, rain), tire strategy stint chart
- **Qualifying recap** — pole sitter + Q1/Q2/Q3 times
- **Personalization** — sign your name, pick your driver; their team color becomes the dashboard accent and they're highlighted everywhere (saved in your browser)
- **Race Center (`/live`)** — dedicated live page: a track map drawn from real car GPS with every car positioned on circuit, full telemetry table (laps, sectors, last/best lap, tires + age, pit stops, speed trap), per-car onboard channel (speed, gear, RPM, throttle, brake, DRS), conditions and race control. Live GPS during sessions; replays the last session otherwise
- **Interactive everywhere** — click any driver for a dossier drawer, head-to-head duel comparator, race calendar tiles that expand into podiums or weekend schedules, DRS battle detection (cars within 1.0 s), gap-graph view, sticky section nav

## Data sources (all free, no API keys)

| Source | Used for | Refresh |
|---|---|---|
| [Jolpica F1](https://github.com/jolpica/jolpica-f1) (Ergast successor) | Schedule, standings, results, qualifying, career stats | 5–10 min |
| [OpenF1](https://openf1.org) | Live positions, intervals, tire stints, weather, race control | 15–30 s when live |

All upstream calls are proxied through Next.js API routes with server-side caching, so the browser never hits rate limits and the dashboard degrades gracefully if an API blips.

### OpenF1 live data (Sponsor tier)

OpenF1's free tier serves historical data only — **live data during sessions requires their Sponsor tier**. If you have it, set these environment variables (Vercel/Netlify → Settings → Environment Variables, or `.env.local` for dev):

```
OPENF1_USERNAME=your-openf1-username
OPENF1_PASSWORD=your-openf1-password
```

The server exchanges these for an OAuth2 token automatically (tokens expire hourly — refresh is handled, including mid-request 401 retries). Credentials never reach the browser. Without them the dashboard still works fully, with sessions appearing ~30 min after they end.

## Run locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

**Option A — CLI (fastest):**
```bash
npm i -g vercel
vercel
```

**Option B — Git:**
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new), import the repo
3. Framework preset: **Next.js** (auto-detected). No env vars needed.
4. Deploy. Done.

## Deploy to Netlify

Also fully supported — API routes run as Netlify serverless functions via the auto-installed Next.js runtime (`netlify.toml` included).

**CLI:**
```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

**Git:** push to GitHub → [app.netlify.com/start](https://app.netlify.com/start) → import the repo → Next.js is auto-detected → deploy. No env vars needed.

## Structure

```
app/
  api/
    standings/   → WDC + WCC (Jolpica)
    schedule/    → season calendar (Jolpica)
    lastrace/    → results + quali + weather + stints (Jolpica + OpenF1)
    live/        → latest session timing tower (OpenF1)
    driver/[id]/ → career stats (Jolpica)
  layout.js      → fonts, metadata, atmosphere layers
  page.js
  globals.css    → the full sci-fi HUD design system
components/      → Dashboard, Hero, TimingTower, Standings, Calendar,
                   LastRace, FavDriver, ProfileModal, Panel
lib/             → fetch helpers, team colors, tire compounds
```

---

Unofficial fan project. Not affiliated with Formula 1, the FIA, FOM, or any team.
