# Skyline — free multi-language weather forecast

**Live: https://skyline-free-weather.netlify.app**

A two-page weather site with 25 features across 14 languages. No build step, no
API keys, no paid services, no accounts, no tracking.

| Page | What it is |
|---|---|
| `index.html` | **The forecast** — served at `/`, the front door |
| `guide.html` | **"What it means"** — every feature explained in plain English, with an honest badge for how far to trust it |

## What it does

Thirteen cards fed by [Open-Meteo](https://open-meteo.com/): hourly forecast, rain,
7-day outlook, wind, sky and cloud layers, pollen, moisture and dew point, storm
risk, ground conditions, air quality, sun times, sea state and climate gases.
Every card carries a `?` link to its explanation on the guide page.

## Honesty rules this site follows

- **No invented data.** If a reading is missing, the card says so. It never
  shows a zero where the truth is "we don't know."
- **Air quality shows two scales.** The same air reads **49** on the European
  scale and **82** on the US EPA scale, and people compare the number to their
  phone. Both are displayed, and the card states that the figure comes from a
  model on a ~11 km grid — one cell covers roughly a whole town, so it is not a
  reading from a monitor nearby.
- **A coverage gap is not a reading.** Outside CAMS Europe, pollen says there is
  no forecast for the location rather than reporting 0.
- **The sea card hides itself** inland instead of showing placeholder numbers.
- **Total failure is stated.** If the weather service cannot be reached, the cards
  hide and one honest error message is shown — not a screen of "Loading…" that
  will never resolve.

## Languages

14 locales, 354 keys each, parity checked in CI-style tests: English, हिन्दी,
বাংলা, ଓଡ଼ିଆ, Español, Français, Deutsch, Português, Русский, العربية (RTL),
中文, 日本語, 한국어, Indonesia.

Note honestly: this is 14 languages, not "all languages." The 27 guide notes are
English-only by design.

## Running it locally

```bash
python3 server.py
```

Then open <http://localhost:8000>. `server.py` is a standard-library server that
proxies the Open-Meteo calls so API keys could be added later; the site also works
on plain static hosting, where it calls Open-Meteo directly from the browser.

## Deployment

Static files. Upload the folder to Netlify, Cloudflare Pages or GitHub Pages.

- `robots.txt` and `sitemap.xml` let search engines find both pages.
- `_headers` adds cache and security headers on Netlify (ignored elsewhere).
- The site is verified in Google Search Console via an HTML tag in `index.html`.

## Data and licensing

Weather and air quality data: **Open-Meteo**, CC-BY 4.0.
Land cover: **© OpenStreetMap contributors**, ODbL.
See `NOTICE` for the full attribution.

## Author

**Divyansh Maharana** — built and maintains this site.

This is an independent hobby project, not an official meteorological service. For
warnings and life-safety decisions, always follow your national weather agency
(e.g. IMD, NOAA).
