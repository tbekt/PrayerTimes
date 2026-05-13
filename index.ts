const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Main route - Prayer times page
app.get('/', async (req, res) => {
    try {
        // Get city and country from query parameters or use defaults
        const city = req.query.city || 'Antwerp';
        const country = req.query.country || 'Belgium';
        
        // Fetch prayer times from API
        // Using method 12 (Diyanet - Turkey) and madhab 1 (Hanafi)
        const response = await axios.get('http://api.aladhan.com/v1/timingsByCity', {
            params: {
                city: city,
                country: country,
                method: 12,    // Diyanet (Turkey)
                madhab: 1      // Hanafi
            }
        });

        const data = response.data.data;
        const timings = data.timings;
        
        // Get current time to highlight next prayer
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        // Find next prayer
        const prayers = [
            { name: 'Fajr', time: timings.Fajr },
            { name: 'Sunrise', time: timings.Sunrise },
            { name: 'Dhuhr', time: timings.Dhuhr },
            { name: 'Asr', time: timings.Asr },
            { name: 'Maghrib', time: timings.Maghrib },
            { name: 'Isha', time: timings.Isha }
        ];
        
        let nextPrayer = null;
        for (const prayer of prayers) {
            if (prayer.time > currentTime) {
                nextPrayer = prayer;
                break;
            }
        }
        
        if (!nextPrayer && prayers[0]) {
            nextPrayer = { name: 'Fajr (Tomorrow)', time: prayers[0].time };
        }

        // Render the page with prayer times
        res.render('index', {
            prayerTimes: timings,
            date: data.date.readable,
            hijriDate: data.date.hijri,
            nextPrayer: nextPrayer,
            currentTime: currentTime,
            location: `${city}, ${country}`,
            method: 'Diyanet (Turkey) - Hanafi',
            error: null
        });
        
    } catch (error) {
        console.error('Error fetching prayer times:', error.message);
        const city = req.query.city || 'Antwerp';
        const country = req.query.country || 'Belgium';
        res.render('index', {
            prayerTimes: null,
            error: 'Unable to fetch prayer times. Please try again later.',
            date: null,
            hijriDate: null,
            nextPrayer: null,
            currentTime: null,
            location: `${city}, ${country}`,
            method: 'Diyanet (Turkey) - Hanafi'
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Prayer times app running on http://localhost:${PORT}`);
    console.log(`📍 Location: Antwerp, Belgium`);
    console.log(`🕋 Calculation: Diyanet (Method 12) - Hanafi`);
});