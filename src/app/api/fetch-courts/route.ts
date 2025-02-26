
export const GET = async () => {
    try {
        const apifyToken = process.env.APIFY_TOKEN;
        const actorURL = process.env.ACTOR_URL;
        if (!apifyToken || !actorURL) {
            throw new Error('APIFY_TOKEN or ACTOR_URL is not defined');
        }

        // Assuming you have some logic to fetch data using the token
        const response = await fetch(`${actorURL}?token=${apifyToken}`);
        if (!response.ok) {
            throw new Error('Failed to fetch data from Apify');
        }
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200 })

    } catch(error) {
        return new Response(`Failed to fetch data ${error}`, { status: 500 })
    }
}