// Axios - Promise based HTTP client for the browser and node.js (Read more at https://axios-http.com/docs/intro).
import axios from 'axios';
import { chromium, Locator, Page } from 'playwright'

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

const sprint_handler = async (page: Page, label: string) => {
    const results: EmptySlot[] = [];
    await page.waitForSelector('table#tableLekce .mycard_skupinovky2');
    const tables = await page.locator('table#tableLekce .mycard_skupinovky2').all();

    for (const table of tables) {
        // In this HTML, booking cards are inside the table with id "tableLekce"
        // Each card is contained in a div with class "mycard_skupinovky2"
        const cards = await page.locator('div.mycard_skupinovky2').all();
        for (const card of cards) {
            // Extract court name (can be a comma-separated list)
            const courtName = (await card.locator('input[data-identifi="KurtyName"]').getAttribute('value'))?.trim() || '';
            // Extract date (as provided in the hidden field)
            const date = (await card.locator('input[data-identifi="DatumLekce2"]').getAttribute('value'))?.trim() || '';
            // Extract the time slot from the visible element (e.g., "20:00 - 21:00")
            const timeSlot = (await card.locator('span[data-identifi="SkupCasOdDo"]').textContent())?.trim() || '';

            // Only push if we have the basic info:
            if (date && timeSlot && courtName) {
                results.push({
                    url: label,
                    date: date,
                    hour: `${timeSlot} (${courtName})`
                });
            }
        };
    }

    return results;

}

const get_viktoria_next_day = async (page: Page) => {
    const days = await page.locator('#timelineCalendar ul li').all();
    for (let i = 0; i < days.length; i++) {
        if ((await days[i].getAttribute('class'))?.includes('active')) {
            return days[i + 1].locator('a').first();
        }
    }
    throw new Error("No link to next day")
}

const viktoria_handler = async (page: Page, label: string) => {
    const results: EmptySlot[] = [];
    await page.waitForSelector('#timelineCalendar ul li.active');

    const NUM_DAYS = 7;
    const days = await page.locator('#timelineCalendar ul li').all();

    for (let i = 0; i < NUM_DAYS; i++) {

        const current_date = await page.locator("section#schedule_holder div#day_actual").innerText()

        const courtBlockHours = (await page.locator("div#hours_head table.schedule tr td").all());
        const courtBlockHoursMap = await courtBlockHours.reduce<Promise<{ [key: string]: string }>>(async (accPromise, block) => {
            const acc: { [key: string]: string } = await accPromise;
            const id = await block.getAttribute('id');
            const value = (await block.innerText()).trim();
            if (id && value) {
                acc[id] = value;
            }
            return acc;
        }, Promise.resolve({}));

        const courtLabels = await page.locator('div#activities_halls > ul li:has(span:text("Badminton")) > ul > li').allInnerTexts();

        const courtsSlots = await page.locator('div#hours_body div.table_schedule_viewport div.table_schedule_holder table.schedule tr[data-parent-row-id]').all();
        for (let j = 0; j < courtsSlots.length; j++) {
            const courtSlotLine = courtsSlots[j];

            const blocks = await courtSlotLine.locator("td").filter({ hasNot: courtSlotLine.locator("td.disabled") }).all()

            for(let k = 0; k < blocks.length; k++) {
                const block = blocks[k];
                const blockId = await block.getAttribute("data-time-id")
                if(!blockId) {
                    // disabled or booked
                    continue;
                }
                const timeSlot = courtBlockHoursMap[blockId]
                if(!timeSlot) {
                    continue;
                }
                const courtName = courtLabels[j]
                if (current_date && timeSlot && courtName) {
                    results.push({
                        url: label,
                        date: current_date,
                        hour: `${timeSlot} (${courtName})`
                    });
                }
            }
        }

        const next_day_link = await get_viktoria_next_day(page);
        await next_day_link.click();
        await page.waitForSelector('div#hours_body div.table_schedule_viewport div.table_schedule_holder table.schedule');
    }

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
    {
        url: "https://rezervace.centrumviktoria.cz:18443/timeline/day?tabIdx=1&criteriaTimestamp&resetFilter=true#timelineCalendar",
        handler: viktoria_handler
    },
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