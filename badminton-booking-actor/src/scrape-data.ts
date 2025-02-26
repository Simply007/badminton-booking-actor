// Axios - Promise based HTTP client for the browser and node.js (Read more at https://axios-http.com/docs/intro).
import axios from 'axios';
// Cheerio - The fast, flexible & elegant library for parsing and manipulating HTML and XML (Read more at https://cheerio.js.org/).
import * as cheerio from 'cheerio';
// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from 'apify';

type EmptySlot = {
    url: string;
    date: string;
    hour: string;
    label?: string;
};

type UrlHandler = {
    url: string;
    handler: ($: cheerio.CheerioAPI, url: string) => EmptySlot[];
};

const bizzy_handler = ($: cheerio.CheerioAPI, url: string) => {
    const results: EmptySlot[] = [];

    // For each schedule table
    $('table.schedule').each((_i, tableElem) => {
        const $table = $(tableElem);
        // Extract the date from the caption span (e.g., "St 26/2")
        const date = $table.find('caption span.group.date').first().text().trim();

        // Extract time slot headers from the heading row.
        // We assume the first <th> is the day header (or court header placeholder)
        const times: string[] = [];
        $table.find('tr.heading th').each((index, thElem) => {
            if (index === 0) return; // skip the first cell
            const timeText = $(thElem).text().trim();
            if (timeText) {
                times.push(timeText);
            }
        });

        // For each row (each court)
        $table.find('tr').not('.heading').each((_rowIndex, rowElem) => {
            const $row = $(rowElem);
            // First cell (a <th>) is the court name
            const court = $row.find('th').first().text().trim();

            // Iterate over each <td> (each time slot cell)
            $row.find('td').each((cellIndex, cellElem) => {
                const cellText = $(cellElem).text().trim();
                // If the cell is empty, then the slot is available.
                if (cellText === '') {
                    // Use the corresponding time from our headers (matching by cellIndex)
                    const timeSlot = times[cellIndex];
                    if (timeSlot) {
                        results.push({
                            url: url,
                            date,
                            hour: `${timeSlot} (${court})`
                        });
                    }
                }
            });
        });
    });

    return results;
}

const sprint_handler = ($: cheerio.CheerioAPI, url: string) => {
    const results: EmptySlot[] = [];

    // In this HTML, booking cards are inside the table with id "tableLekce"
    // Each card is contained in a div with class "mycard_skupinovky2"
    $('#tableLekce .mycard_skupinovky2').each((_i, elem) => {
        const $card = $(elem);
        // Extract court name (can be a comma-separated list)
        const courtName = $card.find('input[data-identifi="KurtyName"]').attr('value')?.trim() || '';
        // Extract date (as provided in the hidden field)
        const date = $card.find('input[data-identifi="DatumLekce2"]').attr('value')?.trim() || '';
        // Extract the time slot from the visible element (e.g., "20:00 - 21:00")
        const timeSlot = $card.find('span[data-identifi="SkupCasOdDo"]').text().trim();

        // Only push if we have the basic info:
        if (date && timeSlot && courtName) {
            results.push({
                url: url,
                date,
                hour: `${timeSlot} (${courtName})`
            });
        }
    });

    return results;

}

const urlsHandlers: UrlHandler[] = [
    {
        url: "https://memberzone.cz/sprint_tenis/Sportoviste.aspx?ID_Sportoviste=3&NAZEV=Badminton+hala",
        handler: sprint_handler
    },
    {
        url: "https://sportkuklenska.e-rezervace.cz/Branch/pages/Schedule.faces",
        handler: bizzy_handler
    },
    // {
    //     url: "https://rezervace.centrumviktoria.cz:18443/timeline/day?tabIdx=1&criteriaTimestamp&resetFilter=true#timelineCalendar",
    //     handler: ($: cheerio.CheerioAPI) => {
    //         // Implement the handler logic for this URL
    //         // Example: return { url, date: '2023-10-03', hour: '12:00' };
    //         return { url: "https://rezervace.centrumviktoria.cz:18443/timeline/day?tabIdx=1&criteriaTimestamp&resetFilter=true#timelineCalendar", date: '2023-10-03', hour: '12:00' };
    //     }
    // },
    {
        url: "https://xarena.e-rezervace.cz/Branch/pages/Schedule.faces",
        handler: bizzy_handler
    }
];


export const getData = async (): Promise<EmptySlot[]> => {
    const bookings: EmptySlot[] = [];

    for (const { url, handler } of urlsHandlers) {
        // Fetch the HTML content of the page.
        const response = await axios.get(url);

        // Parse the downloaded HTML with Cheerio to enable data extraction.
        const $ = cheerio.load(response.data);

        // Use the handler to process the page and get the result.
        const result = handler($, url);

        // Merge the result from the handler with the headings.
        bookings.push(...result);
    }
    return bookings;
}