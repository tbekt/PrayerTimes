# PrayerTimes

A small Express + EJS app that fetches prayer times from the Aladhan API and displays them with a modern UI.

## Features

- Fetches prayer times via `timingsByCity` (default: Antwerp, Belgium)
- Two-level location selector (country → city)
- Responsive, animated UI (CSS in `public/css/style.css`)

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open your browser at http://localhost:3000

4. Use the country and city dropdowns at the top to switch location.

## Files of interest

- `index.ts` — Express server and API calls. Change default city/country, calculation `method`, or `madhab` here.
- `views/index.ejs` — Main template. The location dropdowns and client-side `locationData` object live here.
- `public/css/style.css` — All styling and animations.

## How to change available countries/cities

The client-side list of countries and cities is defined in `views/index.ejs` inside the `<script>` block as the `locationData` object. Add or remove keys/arrays there to change the dropdown options.

Example:

```js
// in views/index.ejs
const locationData = {
  Belgium: ["Antwerp", "Brussels", "Ghent"],
  "United Kingdom": ["London", "Manchester"],
};
```

After editing, refresh the page.

## Changing calculation method

By default the server requests prayer times with `method: 12` and `madhab: 1` in `index.ts`. To use a different method or madhab, edit the `params` passed to Aladhan in `index.ts`.

## Notes for development

- If you add new dependencies, run `npm install` again.
- The app reads no secrets by default, but if you add API keys later, store them in `.env` and add `.env` to `.gitignore` (already included).

## Contributing / TODOs

- Add more cities per country or integrate a geo API for dynamic city lists
- Allow changing calculation method from the UI
- Add caching for API responses to avoid hitting rate limits

---

If you'd like, I can add a small REST endpoint to return the available cities for a country or wire the country→city dropdown to fetch that dynamically.
