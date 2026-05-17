const express  = require('express');
const axios    = require('axios');
const cheerio  = require('cheerio');
const path     = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
//  City → namaztakvimi.com URL slug map
//  Source: namaztakvimi.com/belcika/index.html
//  These give the exact Diyanet takvim times including the
//  high-latitude summer cap Diyanet applies to Belgium.
// ─────────────────────────────────────────────────────────────
const CITY_SLUGS: Record<string, Record<string, string>> = {
  Belgium: {
    'Antwerp':          'antwerpen-ezan-vakti',
    'Brussels':         'bruksel-ezan-vakti',
    'Ghent':            'gent-ezan-vakti',
    'Bruges':           'brugge-ezan-vakti',
    'Liege':            'liege-ezan-vakti',
    'Charleroi':        'charleroi-ezan-vakti',
    'Mechelen':         'mechelen-ezan-vakti',
    'Leuven':           'leuven-louvain--ezan-vakti',
    'Namur':            'namur-namen-ezan-vakti',
    'Mons':             'mons-bergen-ezan-vakti',
    'Aalst':            'aalst-ezan-vakti',
    'Sint-Niklaas':     'sint-niklaas-ezan-vakti',
    'Hasselt':          'hasselt-ezan-vakti',
    'Kortrijk':         'kortrijk-ezan-vakti',
    'Genk':             'genk-ezan-vakti',
    'Tournai':          'tournai-ezan-vakti',
    'Seraing':          'seraing-ezan-vakti',
    'Roeselare':        'roeselare-ezan-vakti',
    'Mouscron':         'mouscron-ezan-vakti',
    'Verviers':         'verviers-ezan-vakti',
    'Dendermonde':      'dendermonde-ezan-vakti',
    'Turnhout':         'turnhout-ezan-vakti',
    'Beringen':         'beringen-ezan-vakti',
    'Lokeren':          'lokeren-ezan-vakti',
    'Beveren':          'beveren-ezan-vakti',
    'Boom':             'boom-ezan-vakti',
    'Mortsel':          'mortsel-ezan-vakti',
    'Sint-Truiden':     'sint-truiden-ezan-vakti',
  },
};

// ─────────────────────────────────────────────────────────────
//  Cache: keyed by slug, expires at next local midnight
// ─────────────────────────────────────────────────────────────
const cache: Record<string, { data: PrayerData; expires: number }> = {};

function todayMidnight(): number {
  const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime();
}

interface PrayerData {
  Imsak:   string;
  Fajr:    string;
  Sunrise: string;
  Dhuhr:   string;
  Asr:     string;
  Maghrib: string;
  Isha:    string;
  date:    string;
  hijri:   string;
}

// ─────────────────────────────────────────────────────────────
//  Scrape namaztakvimi.com — today's row from the weekly table
// ─────────────────────────────────────────────────────────────
async function scrapeNamaztakvimi(slug: string): Promise<PrayerData> {
  const hit = cache[slug];
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://www.namaztakvimi.com/belcika/${slug}.html`;
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; prayer-times-app/1.0)',
      'Accept-Language': 'tr,en;q=0.9',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(html);

  // The page has h3 elements with the time values in the daily summary section
  // Structure: İmsak h3, Güneş h3, Öğle h3, İkindi h3, Akşam h3, Yatsı h3
  const times: string[] = [];
  $('h3').each((_: number, el: any) => {
    const text = $(el).text().trim();
    if (/^\d{2}:\d{2}$/.test(text)) times.push(text);
  });

  // Also extract date from the page title / heading
  const dateText = $('h3').filter((_: number, el: any) => {
    const t = $(el).text().trim();
    return /\d{1,2}\s+\w+\s+\d{4}/.test(t);
  }).first().text().trim();

  // Extract Hicri from the page (look for Zilkâde, Safer, etc.)
  const hicriEl = $('*').filter((_: number, el: any) => {
    const t = $(el).text().trim();
    return /\d+\s+\w+\s+\d{4}/.test(t) && /Hicri/.test($(el).closest('*').text());
  });

  if (times.length < 6) {
    throw new Error(`Could not parse times from namaztakvimi.com for ${slug} (got ${times.length} times)`);
  }

  // Order: İmsak(=Fajr/Sabah), Güneş, Öğle, İkindi, Akşam, Yatsı
  const [Imsak, Sunrise, Dhuhr, Asr, Maghrib, Isha] = times;

  // Date: try to read from the weekly table's first row date column
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Hijri: find text containing Hicri Takvim on the page
  let hijriStr = '';
  $('*').each((_: number, el: any) => {
    const t = $(el).text().trim();
    // namaztakvimi uses pattern like "30 Zilkâde 1447"
    const m = t.match(/(\d{1,2})\s+(Muharrem|Safer|Rebiülevvel|Rebiülahir|Cemaziyelevvel|Cemaziyelahir|Recep|Şaban|Ramazan|Şevval|Zilkade|Zilkâde|Zilhicce)\s+(\d{4})/i);
    if (m && !hijriStr) hijriStr = `${m[1]} ${m[2]} ${m[3]}`;
  });

  const result: PrayerData = {
    Imsak,
    Fajr: Imsak,   // On this site Imsak = Sabah (Fajr start)
    Sunrise,
    Dhuhr,
    Asr,
    Maghrib,
    Isha,
    date:  dateFormatted,
    hijri: hijriStr,
  };

  cache[slug] = { data: result, expires: todayMidnight() };
  return result;
}

// ─────────────────────────────────────────────────────────────
//  Fallback: aladhan method=13, school=0 (Shafi Asr)
//  for cities/countries not covered by namaztakvimi.com
// ─────────────────────────────────────────────────────────────
async function fetchAladhan(city: string, country: string): Promise<PrayerData> {
  const key = `aladhan:${city},${country}`;
  const hit = cache[key] as any;
  if (hit && hit.expires > Date.now()) return hit.data as PrayerData;

  const res = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
    params: { city, country, method: 13, school: 0 },
    timeout: 10000,
  });

  const { timings, date } = res.data.data;
  const clean = (t: string) => t.replace(/\s*\(.*\)$/, '').trim();

  const hijri = date.hijri;
  const hijriStr = `${hijri.day} ${hijri.month.en} ${hijri.year}`;

  const result: PrayerData = {
    Imsak:   clean(timings.Imsak),
    Fajr:    clean(timings.Fajr),
    Sunrise: clean(timings.Sunrise),
    Dhuhr:   clean(timings.Dhuhr),
    Asr:     clean(timings.Asr),
    Maghrib: clean(timings.Maghrib),
    Isha:    clean(timings.Isha),
    date:    date.readable,
    hijri:   hijriStr,
  };

  cache[key] = { data: result, expires: todayMidnight() } as any;
  return result;
}

// ─────────────────────────────────────────────────────────────
//  Helper
// ─────────────────────────────────────────────────────────────
function toMinutes(t: string): number {
  const [h, m] = t.replace(/\s*\(.*\)$/, '').trim().split(':').map(Number);
  return h * 60 + m;
}

// ─────────────────────────────────────────────────────────────
//  Route
// ─────────────────────────────────────────────────────────────
app.get('/', async (req: any, res: any) => {
  const city:    string = (req.query.city    as string) || 'Antwerp';
  const country: string = (req.query.country as string) || 'Belgium';

  try {
    let prayerData: PrayerData;
    const slug = CITY_SLUGS[country]?.[city];

    if (slug) {
      prayerData = await scrapeNamaztakvimi(slug);
    } else {
      // Countries other than Belgium → aladhan with Diyanet method
      prayerData = await fetchAladhan(city, country);
    }

    const prayerTimes = {
      Fajr:    prayerData.Fajr,
      Imsak:   prayerData.Imsak,
      Sunrise: prayerData.Sunrise,
      Dhuhr:   prayerData.Dhuhr,
      Asr:     prayerData.Asr,
      Maghrib: prayerData.Maghrib,
      Isha:    prayerData.Isha,
      Sunset:  prayerData.Maghrib,
      Midnight:'--:--',
    };

    // Build hijriDate shape the template expects
    const hijriParts = prayerData.hijri.split(' ');
    const hijriDate = hijriParts.length >= 3
      ? { hijri: { day: hijriParts[0], month: { en: hijriParts[1] }, year: hijriParts[2] } }
      : null;

    // Next prayer
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const prayers = [
      { name: 'Fajr',    turkishName: 'Sabah',  time: prayerTimes.Fajr    },
      { name: 'Sunrise', turkishName: 'Güneş',  time: prayerTimes.Sunrise },
      { name: 'Dhuhr',   turkishName: 'Öğle',   time: prayerTimes.Dhuhr   },
      { name: 'Asr',     turkishName: 'İkindi', time: prayerTimes.Asr     },
      { name: 'Maghrib', turkishName: 'Akşam',  time: prayerTimes.Maghrib },
      { name: 'Isha',    turkishName: 'Yatsı',  time: prayerTimes.Isha    },
    ];

    let nextPrayer = prayers.find(p => p.time !== '--:--' && toMinutes(p.time) > nowMinutes);
    if (!nextPrayer) nextPrayer = { ...prayers[0], name: 'Fajr (Tomorrow)' };

    res.render('index', {
      prayerTimes,
      prayers,
      date:      prayerData.date,
      hijriDate,
      nextPrayer,
      location:  `${city}, ${country}`,
      error:     null,
    });

  } catch (err: any) {
    console.error('Error:', err.message);
    res.render('index', {
      prayerTimes: null,
      prayers:     null,
      error:       `Could not load prayer times for ${city}, ${country}. Please try again later.`,
      date:        new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      hijriDate:   null,
      nextPrayer:  null,
      location:    `${city}, ${country}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Prayer times running on http://localhost:${PORT}`);
  console.log(`   Belgium: namaztakvimi.com (exact Diyanet takvim)`);
  console.log(`   Other countries: aladhan.com method=13 (Diyanet algorithm)`);
});