import express from "express";
import { getData } from './scrape-data.js';

const app = express();
app.use(express.json());  // Support JSON payloads

const PORT = 3333;

app.get('/run-actor', async (_req: any, res: any) => {
    try {
        // Run the actor with the URL
        const result = await getData();
        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Actor error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
