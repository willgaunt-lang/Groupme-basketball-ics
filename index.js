const express = require('express');
const fetch = require('node-fetch');
const ical = require('ical-generator');
const app = express();
const PORT = process.env.PORT || 3000;

let cachedEvents = null;
let cacheTimestamp = 0;
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION || '60') * 60 * 1000; // ms

app.get('/calendar.ics', async (req, res) => {
  const now = Date.now();
  if (!cachedEvents || now - cacheTimestamp > CACHE_DURATION) {
    try {
      const groupId = process.env.GROUPME_GROUP_ID;
      const apiKey = process.env.GROUPME_API_KEY;
      const response = await fetch(`https://api.groupme.com/v3/groups/${groupId}/calendar?token=${apiKey}`);
      const data = await response.json();
      if (data.meta.code !== 200) throw new Error('API error');

      const events = data.response.events || [];
      cachedEvents = events.map(event => ({
        start: new Date(event.starts_at),
        end: new Date(event.ends_at),
        summary: event.title || 'GroupMe Event',
        description: event.description || '',
        location: event.location || ''
      }));
      cacheTimestamp = now;
    } catch (error) {
      console.error('Cache refresh failed:', error);
      cachedEvents = []; // Fallback to empty
    }
  }

  const cal = ical({ name: process.env.GROUPME_STATIC_NAME || 'GroupMe Calendar' });
  cachedEvents.forEach(event => cal.createEvent(event));
  res.type('text/calendar; charset=utf-8');
  res.send(cal.toString());
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
