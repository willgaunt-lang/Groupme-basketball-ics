const express = require('express');
const fetch = require('node-fetch');
const ical = require('ical-generator');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Server is running! ICS at /calendar.ics'));

let cachedEvents = null;
let cacheTimestamp = 0;
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION || '60') * 60 * 1000; // ms

app.get('/calendar.ics', async (req, res) => {
  console.log('ICS route hit');
  const now = Date.now();
  if (!cachedEvents || now - cacheTimestamp > CACHE_DURATION) {
    try {
      const groupId = process.env.GROUPME_GROUP_ID;
      const apiKey = process.env.GROUPME_API_KEY;
      console.log('Fetching from GroupMe API with group ID:', groupId);
      const response = await fetch(`https://api.groupme.com/v3/groups/${groupId}/calendar?token=${apiKey}`);
      const data = await response.json();
      console.log('API response meta:', data.meta);
      if (data.meta.code !== 200) throw new Error('API error: ' + data.meta.code);
      const events = data.response.events || [];
      console.log('Found', events.length, 'events');
      cachedEvents = events.map(event => ({
        start: new Date(event.starts_at),
        end: new Date(event.ends_at || event.starts_at), // Fallback for all-day
        summary: event.title || 'GroupMe Event',
        description: event.description || '',
        location: event.location || ''
      }));
      cacheTimestamp = now;
    } catch (error) {
      console.error('Cache refresh failed:', error.message);
      cachedEvents = []; // Fallback to empty
    }
  }

  const cal = ical({ name: process.env.GROUPME_STATIC_NAME || 'GroupMe Calendar' });
  cachedEvents.forEach(event => cal.createEvent(event));
  const icsContent = cal.toString();
  console.log('Generated ICS length:', icsContent.length);
  res.attachment('calendar.ics');
  res.type('text/calendar; charset=utf-8');
  res.send(icsContent);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
