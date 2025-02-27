// Axios - Promise based HTTP client for the browser and node.js (Read more at https://axios-http.com/docs/intro).
import axios from 'axios';
import { chromium, Page } from 'playwright'

type EmptySlot = {
    url: string;
    date: string;
    hour: string;
    label?: string;
};

type UrlHandler = {
    url: string;
    handler: (page: Page, label: string) => Promise<EmptySlot[]>;
};

const bizzy_handler = async (page: Page, label: string) => {
    const results: EmptySlot[] = [];
    await page.waitForSelector('div#resContainer div.event');
    const tables = await page.locator("table.schedule").all();
    const overlayBookingDivs = await page.locator('div#resContainer div.event').all()
    const overlayBookingDivsBoxes = await Promise.all(overlayBookingDivs.map(async el => await el.boundingBox()));


    for (const table of tables) {
        const date = (await table.locator("caption span.group.date").first().textContent())?.trim();

        const times: string[] = [];
        const blocks = await table.locator('tr.heading th').all();
        for (const [index, block] of blocks.entries()) {
            if (index === 0)
                continue; // skip the first cell
            const timeText = (await block.textContent())?.trim();
            if (timeText) {
                times.push(timeText);
            }
        }

        const rows = await table
            .locator("tr")
            .filter({
                hasNot: table.locator(".heading")
            }).all();

        for (const row of rows) {
            const court = (await row.locator('th').first().textContent())?.trim();

            const allRowCells = await row
                .locator('td')
                .all();
            for (const [cellIndex, bookingSlot] of allRowCells.entries()) {
                const isPastTime = (await bookingSlot.getAttribute('class'))?.includes('pastTime');
                const timeSlot = times[cellIndex];

                let bookingBlok: EmptySlot | null = {
                    url: label,
                    date: date || 'N/A',
                    hour: `${timeSlot} (${court})`
                }

                if (!isPastTime) {
                    const timeSlotBox = await bookingSlot.boundingBox();
                    for (const bookingDiv of overlayBookingDivsBoxes) {
                        if (timeSlotBox && bookingDiv) {
                            const isCovered = bookingDiv.x < timeSlotBox.x + timeSlotBox.width / 2 &&
                                bookingDiv.x + bookingDiv.width > timeSlotBox.x + timeSlotBox.width / 2 &&
                                bookingDiv.y < timeSlotBox.y + timeSlotBox.height / 2 &&
                                bookingDiv.y + bookingDiv.height > timeSlotBox.y + timeSlotBox.height / 2;
                            if (isCovered) {
                                bookingBlok = null
                                break;
                            }
                        }
                    }

                    if (timeSlot && bookingBlok) {
                        results.push(bookingBlok);
                    }
                }
            }
        }
    }

    return results;
}

const sprint_handler = async (_page: Page, _label: string) => {
    const results: EmptySlot[] = [];

    // // In this HTML, booking cards are inside the table with id "tableLekce"
    // // Each card is contained in a div with class "mycard_skupinovky2"
    // $('#tableLekce .mycard_skupinovky2').each((_i, elem) => {
    //     const $card = $(elem);
    //     // Extract court name (can be a comma-separated list)
    //     const courtName = $card.find('input[data-identifi="KurtyName"]').attr('value')?.trim() || '';
    //     // Extract date (as provided in the hidden field)
    //     const date = $card.find('input[data-identifi="DatumLekce2"]').attr('value')?.trim() || '';
    //     // Extract the time slot from the visible element (e.g., "20:00 - 21:00")
    //     const timeSlot = $card.find('span[data-identifi="SkupCasOdDo"]').text().trim();

    //     // Only push if we have the basic info:
    //     if (date && timeSlot && courtName) {
    //         results.push({
    //             url: label,
    //             date,
    //             hour: `${timeSlot} (${courtName})`
    //         });
    //     }
    // });

    return results;

}

const urlsHandlers: UrlHandler[] = [
    // {
    //     url: "https://memberzone.cz/sprint_tenis/Sportoviste.aspx?ID_Sportoviste=3&NAZEV=Badminton+hala",
    //     handler: sprint_handler
    // },
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
    const browser = await chromium.launch({ headless: true });

    for (const { url, handler } of urlsHandlers) {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });

        // Use the handler to process the page and get the result.
        const result = await handler(page, url);
        // Merge the result from the handler with the headings.
        bookings.push(...result);
    }
    return bookings;
}