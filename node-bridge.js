const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ANIME, MANGA, NEWS } = require('@consumet/extensions');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const mangapill = new MANGA.MangaPill();
const ann = new NEWS.ANN();

app.get('/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL is required');
    try {
        const response = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': new URL(url).origin + '/'
            }
        });
        res.set('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (err) {
        res.status(500).send('Proxy error');
    }
});
app.get('/manga/mangapill/info', async (req, res) => {
    try {
        const id = req.query.id;
        const results = await mangapill.fetchMangaInfo(id);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/manga/mangapill/read', async (req, res) => {
    try {
        const chapterId = req.query.chapterId;
        const results = await mangapill.fetchChapterPages(chapterId);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/manga/mangapill/:query', async (req, res) => {
    try {
        const query = req.params.query;
        if (query === 'popular') {
             // Not sure if mangapill has popular, fallback to empty or handle gracefully
             const results = await mangapill.search('a');
             return res.json(results);
        }
        const results = await mangapill.search(query);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/news/ann/recent-feeds', async (req, res) => {
    try {
        const results = await ann.fetchNewsFeeds();
        const proxied = results.map(item => ({
            ...item,
            image: `http://localhost:3001/proxy-image?url=${encodeURIComponent(item.thumbnail || item.image)}`
        }));
        res.json(proxied);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/news/ann/info', async (req, res) => {
    try {
        const id = req.query.id;
        const results = await ann.fetchNewsInfo(id);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Node Bridge listening at http://localhost:${port}`);
});
