const express = require('express');
console.log('--- NODE BRIDGE STARTING ---');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logFile = path.join(os.homedir(), 'genga_bridge_debug.log');

function log(msg) {
    const text = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    try { fs.appendFileSync(logFile, text); } catch (e) { }
}

log('Bridge script loaded');

// Retry wrapper to handle ECONNRESET and transient network errors
async function withRetry(fn, label = 'Operation', maxAttempts = 3, delay = 1500) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            log(`${label} attempt ${attempt} failed: ${e.message}`);
            if (attempt < maxAttempts) {
                // Exponential backoff with jitter
                const backoff = delay * Math.pow(1.5, attempt - 1);
                await new Promise(r => setTimeout(r, backoff)); 
            }
        }
    }
    throw lastError;
}

// Global error handlers to prevent silent exits
process.on('uncaughtException', (err) => {
    log(`FATAL: Uncaught Exception: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`FATAL: Unhandled Rejection at: ${promise} reason: ${reason}`);
});

const axios = require('axios');
const cheerio = require('cheerio');

let MANGA, NEWS, ANIME;
let animepahe, gogoanime, mangapill;

async function initExtensions() {
    try {
        const ext = require('@consumet/extensions');
        MANGA = ext.MANGA;
        NEWS = ext.NEWS;
        ANIME = ext.ANIME;
        
        log('All extensions loaded successfully');
        const create = (cls) => {
            if (!cls) return null;
            if (typeof cls === 'function') return new cls();
            if (cls.default && typeof cls.default === 'function') return new cls.default();
            // Handle case where it's an object with the class inside
            const firstKey = Object.keys(cls)[0];
            if (firstKey && typeof cls[firstKey] === 'function') return new cls[firstKey]();
            return null;
        };

        animepahe = create(ANIME.AnimePahe);
        try {
            gogoanime = create(ANIME.AnimeSama) || { search: () => ({ results: [] }), fetchAnimeInfo: () => ({ episodes: [] }) }; 
        } catch (e) {
            log(`Warning: Gogo fallback init failed: ${e.message}`);
            gogoanime = { search: () => ({ results: [] }), fetchAnimeInfo: () => ({ episodes: [] }) };
        }
        mangapill = create(MANGA.MangaPill);
        
        return true;
    } catch (e) {
        log(`CRITICAL: Failed to load extensions: ${e.message}`);
        return false;
    }
}

const app = express();
const port = 8001;
// Instances will be initialized in startServer()

app.use(express.json());
app.use((req, res, next) => {
    log(`${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'NodeBridge', timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/system/ip', (req, res) => {
    const nets = os.networkInterfaces();
    let result = '127.0.0.1';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                result = net.address;
                break;
            }
        }
        if (result !== '127.0.0.1') break;
    }
    res.json({ ip: result });
});

const getPoster = (it) => {
    if (!it) return '';
    let p = it.poster || it.image || it.snapshot || it.screenshot || it.episodeImage || it.img || it.thumbnail || it.cover || it.header_image || it.banner_image || '';
    
    // Handle nested objects from some providers
    if (typeof p === 'object' && p !== null) {
        p = p.url || p.large || p.medium || p.small || p.original || '';
    }
    
    if (typeof p === 'string') {
        if (p.startsWith('//')) p = 'https:' + p;
        // Fix for some malformed URLs
        if (p.includes(' ') && !p.startsWith('http')) p = p.trim();
    }
    return p;
};

const normalize = (list) => (list || []).map(it => {
    let poster = getPoster(it);
    // Proxy the poster via our backend image-proxy to bypass hotlinking
    if (poster && typeof poster === 'string' && poster.startsWith('http') && !poster.includes('image-proxy')) {
        // Use 127.0.0.1 instead of localhost for better compatibility
        poster = `http://127.0.0.1:8000/api/image-proxy?url=${encodeURIComponent(poster)}`;
    }
    
    return {
        id: it.id,
        title: it.name || it.title || it.animeTitle || '',
        poster: poster || null,
        poster_url: poster || null, 
        source: 'animepahe',
        type: 'anime',
        description: it.description || it.plot || '',
        sub: true,
        dub: it.isDub || false,
        episode: it.episodeNumber || it.episode || ''
    };
});

// --- Anime ---
app.get('/anime/home', async (req, res) => {
    let groups = [];
    try {
        log('Attempting AnimePahe Recent Home...');
        const results = await withRetry(() => animepahe.fetchRecentEpisodes(), 'AnimePahe Home', 3, 1000);
        if (results && results.results?.length > 0) {
            groups.push({ title: 'Recent Episodes', items: normalize(results.results) });
        }
    } catch (e) { log(`AnimePahe Home failed: ${e.message}`); }

    if (groups.length === 0) {
        log('Falling back to Gogoanime...');
        try {
            const results = await withRetry(() => gogoanime.search('popular'), 'Gogoanime fallback', 2, 1000);
            if (results && results.results?.length > 0) groups.push({ title: 'Gogo Popular', items: normalize(results.results) });
        } catch (e3) { log(`Gogoanime search failed: ${e3.message}`); }
    }
    res.json(groups);
});

app.get('/anime/search', async (req, res) => {
    try {
        const { query } = req.query;
        log(`Anime Search requested: ${query}`);
        try { 
            const results = await withRetry(() => animepahe.search(query), `AnimePahe search: ${query}`, 2); 
            if (results && results.results?.length > 0) {
                return res.json(normalize(results.results)); 
            }
            throw new Error("No results from AnimePahe");
        }
        catch (e) { 
             log(`AnimePahe search failed: ${e.message}, trying Gogoanime fallback`);
             try {
                 log(`Trying Gogoanime fallback for: ${query}`);
                 const results = await withRetry(() => gogoanime.search(query), `Gogo search: ${query}`, 1); 
                 return res.json(normalize(results.results)); 
             } catch (e3) { 
                 log(`All anime search fallbacks failed`);
                 res.json([]); 
             }
        }
    } catch (err) { res.json([]); }
});

app.get('/anime/details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        try { 
            const results = await withRetry(() => animepahe.fetchAnimeInfo(id), `AnimePahe info: ${id}`, 2);
            const episodes = (results.episodes || []).map(ep => ({
                number: ep.number,
                episodeId: ep.id,
                title: ep.title || `Episode ${ep.number}`
            }));
            const poster = results.image || results.poster;
            const proxiedPoster = poster ? `http://localhost:8000/api/image-proxy?url=${encodeURIComponent(poster)}` : '';
            
            const details = {
                id: results.id,
                name: results.title || results.name,
                poster: proxiedPoster,
                description: results.description || results.plot || '',
                episodes: episodes,
                animeEpisodes: episodes // Provide both for safety
            };
            res.json(details); 
        }
        catch (e) {
            try {
                const results = await withRetry(() => gogoanime.fetchAnimeInfo(id), `Gogo info: ${id}`, 2);
                const poster = results.image;
                const proxiedPoster = poster ? `http://localhost:8000/api/image-proxy?url=${encodeURIComponent(poster)}` : '';
                res.json({ id: results.id, name: results.title, poster: proxiedPoster, description: results.description, animeEpisodes: (results.episodes || []).map(ep => ({ number: ep.number, episodeId: ep.id, title: `Episode ${ep.number}` })) });
            } catch (e3) { res.status(500).json({ error: e3.message }); }
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/anime/episodes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        log(`Fetching Anime Episodes for: ${id}`);
        let episodes = [];
        try { 
            const results = await withRetry(() => animepahe.fetchAnimeInfo(id), `AnimePahe episodes: ${id}`, 2);
            episodes = (results.episodes || []).map(ep => ({
                number: ep.number,
                episodeId: ep.id,
                title: ep.title || `Episode ${ep.number}`
            }));
            log(`AnimePahe Ext found ${episodes.length} episodes`);
        } catch (e) {
            log(`AnimePahe Ext failed: ${e.message}, trying fallback`);
            try {
                const results = await withRetry(() => gogoanime.fetchAnimeInfo(id), `Gogo episodes fallback: ${id}`, 2);
                episodes = (results.episodes || []).map(ep => ({ number: ep.number, episodeId: ep.id, title: ep.title || `Episode ${ep.number}` }));
            } catch (e3) {
                log(`All anime episode fallbacks failed for ${id}`);
            }
        }
        res.json({ status: 200, data: { episodes: episodes } });
    } catch (err) { 
        log(`Anime Episodes Global Error: ${err.message}`);
        res.json({ status: 200, data: { episodes: [] } }); 
    }
});

app.get('/anime/sources', async (req, res) => {
    const { episodeId } = req.query;
    log(`Fetching Anime Sources for: ${episodeId}`);
    try {
        try { 
            const results = await withRetry(() => animepahe.fetchEpisodeSources(episodeId), `AnimePahe sources: ${episodeId}`, 2);
            log(`AnimePahe Ext sources found`);
            return res.json(results); 
        } catch (e) {
             log(`AnimePahe Ext sources failed: ${e.message}, trying Gogoanime fallback`);
             try {
                 const results = await withRetry(() => gogoanime.fetchEpisodeSources(episodeId), `Gogo sources fallback: ${episodeId}`, 1);
                 log(`Fallback sources found`);
                 return res.json(results);
             } catch (e2) {
                 log(`All anime source fallbacks failed for ${episodeId}`);
                 return res.status(500).json({ error: 'All providers failed' });
             }
        }
    } catch (err) { 
        log(`Anime Sources Global Error: ${err.message}`);
        res.status(500).json({ error: err.message }); 
    }
});

// --- Manga (Refactor v3) ---

// 1. Details / Info (Must be specific to avoid conflicts)
app.get('/manga/mangapill/info', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing Manga ID' });
        log(`[Manga Bridge] Fetching Info: ${id}`);
        
        // Strip leading slash if present (Consumet library often adds it)
        const cleanId = id.startsWith('/') ? id.substring(1) : id;
        
        let info = null;
        try {
            info = await withRetry(() => mangapill.fetchMangaInfo(cleanId), `Manga info: ${cleanId}`, 2);
        } catch (e) {
            log(`[Manga Bridge] Fetch failed for ${cleanId} after all retries`);
            return res.status(500).json({ error: e.message });
        }
        
        if (info) {
            // Consistency fix for Consumet
            if (!info.chapters && info.results) info.chapters = info.results;
            
            const chapterCount = info.chapters ? info.chapters.length : 0;
            log(`[Manga Bridge] Success: "${info.title}" | ${chapterCount} chapters`);
            
            if (chapterCount === 0) {
                log(`[Manga Bridge] WARNING: No chapters found for ${cleanId}. Data: ${JSON.stringify(Object.keys(info))}`);
            }
            
            res.json(info);
        } else {
            log(`[Manga Bridge] 404: Manga not found for ${cleanId}`);
            res.status(404).json({ error: 'Manga not found' });
        }
    } catch (err) {
        log(`[Manga Bridge] Info Global Error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 2. Read / Pages
app.get('/manga/mangapill/read', async (req, res) => {
    try {
        const id = req.query.chapterId || req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing Chapter ID' });
        log(`[Manga Bridge] Fetching Pages: ${id}`);
        
        const cleanId = id.startsWith('/') ? id.substring(1) : id;
        const pages = await mangapill.fetchChapterPages(cleanId);
        
        log(`[Manga Bridge] Found ${pages ? pages.length : 0} pages`);
        res.json(pages || []);
    } catch(e) { 
        log(`[Manga Bridge] Read Error: ${e.message}`);
        res.status(500).json({ error: e.message }); 
    } 
});

// 3. Search
app.get(['/manga/mangapill/search', '/api/manga/search', '/manga/search'], async (req, res) => {
    try {
        const query = req.query.q || req.query.query || 'popular';
        const q = (query === 'popular' || query === 'trending') ? 'popular' : query;
        log(`[Manga Bridge] Search: ${q}`);
        
        const results = await mangapill.search(q);
        const list = results.results || results || [];
        log(`[Manga Bridge] Search results: ${list.length}`);
        res.json({ results: list });
    } catch (err) { 
        log(`[Manga Bridge] Search Error: ${err.message}`);
        res.json({ results: [] }); 
    }
});

// 4. Catch-all for legacy or other MangaPill routes (lowest priority)
app.get('/manga/mangapill/:param1', async (req, res) => {
    const p = req.params.param1;
    if (p === 'info' || p === 'read' || p === 'search') return; // Handled above
    
    log(`[Manga Bridge] Legacy Route Match: ${p}`);
    try {
        const results = await mangapill.search(p);
        res.json({ results: results.results || results || [] });
    } catch (e) { res.json({ results: [] }); }
});

// 5. Catch-all for catch-all (details/)*
app.get('/manga/details/:id', async (req, res) => {
    const id = req.params.id;
    log(`[Manga Bridge] Catch-all details: ${id}`);
    // Redirect to info logic
    req.query.id = id;
    // We can't easily redirect internally without changing the URL and re-matching, 
    // so we duplicate the simple fetch or just call another handler.
    try {
        const info = await mangapill.fetchMangaInfo(id);
        if (!info.chapters && info.results) info.chapters = info.results;
        res.json(info);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// --- News ---
// axios and cheerio moved to top
async function fetchNews() {
    return withRetry(async () => {
        log('Fetching latest news from ANN...');
        const resp = await axios.get('https://www.animenewsnetwork.com', {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        });
        const html = resp.data;
        const news = [];
        const $ = cheerio.load(html);
        
        $('.herald.box.news').each((i, el) => {
            if (i >= 24) return false;
            const $el = $(el);
            const title = $el.find('h3 a').text().trim();
            const link = $el.find('h3 a').attr('href');
            let thumbnail = $el.find('div.thumbnail').attr('data-src') || $el.find('img').attr('src');
            
            if (title && link) {
                const fullLink = link.startsWith('http') ? link : 'https://www.animenewsnetwork.com' + link;
                if (thumbnail && !thumbnail.startsWith('http')) {
                    thumbnail = thumbnail.startsWith('//') ? 'https:' + thumbnail : 'https://www.animenewsnetwork.com' + thumbnail;
                }
                news.push({
                    id: link,
                    title: title,
                    thumbnail: thumbnail || 'https://www.animenewsnetwork.com/images/masthead/logo.png',
                    poster: thumbnail || 'https://www.animenewsnetwork.com/images/masthead/logo.png', // Add poster for UI consistency
                    url: fullLink
                });
            }
        });
        
        log(`Successfully parsed ${news.length} news items`);
        if (news.length === 0) throw new Error('No news found');
        return news;
    }, 'News fetch', 2, 2000);
}

app.get(['/news', '/news/latest'], async (req, res) => {
    try {
        const data = await fetchNews();
        res.json({ results: data });
    } catch (e) {
        log(`News route failed: ${e.message}`);
        res.json({ results: [] });
    }
});

app.get('/news/info', async (req, res) => { 
    try { 
        const { id } = req.query;
        log(`Fetching News Info for: ${id}`);
        // ID is already the relative path from fetchNews (e.g. /news/...)
        const result = await new NEWS.ANN().fetchNewsInfo(id);
        res.json(result); 
    } catch (err) { 
        log(`News Info Route Error: ${err.message}`);
        res.json({ title: 'News', content: 'Unavailable' }); 
    } 
});

async function startServer() {
    const success = await initExtensions();
    if (!success) {
        log('Targeting exit due to extension load failure');
        process.exit(1);
    }

    app.listen(port, '0.0.0.0', () => { 
        log(`Bridge listening at http://0.0.0.0:${port}`); 
        // Heartbeat to confirm bridge is alive in logs
        setInterval(() => log('Heartbeat: Bridge is alive'), 30000);
    });
}

startServer();
