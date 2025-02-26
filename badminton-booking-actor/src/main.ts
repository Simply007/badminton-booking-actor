import { Actor } from 'apify';
import { getData } from './scrape-data.js';

await Actor.init();
const bookings = await getData();
// Save headings to Dataset - a table-like storage.
// console.log("Extracted heading", bookings);
await Actor.pushData(bookings);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();