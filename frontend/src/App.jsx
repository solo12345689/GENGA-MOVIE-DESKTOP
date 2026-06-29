import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import MovieCard from './components/MovieCard';
import DetailsModal from './components/DetailsModal';
import WatchPage from './components/WatchPage';
import MangaReader from './components/MangaReader';
import Sidebar from './components/Sidebar';
import MusicCard from './components/MusicCard';
import MusicPlayer from './components/MusicPlayer';
import NewsCard from './components/NewsCard';
import NewsReader from './components/NewsReader';
import TVDiscovery from './components/TVDiscovery';
import RadioDiscovery from './components/RadioDiscovery';
import RadioPlayer from './components/RadioPlayer';
import './styles/index.css';



// Define available backends
// Use localhost for all services as they are bundled locally
const CLOUD_BASE = 'http://localhost:8000';
const NEWS_API_BASE = 'http://localhost:8000';
const LOCAL_BACKEND = 'http://localhost:8000';


function App() {
    // State for local server configuration

    const navigate = useNavigate();
    const location = useLocation();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const internalNavRef = React.useRef(false);

    const [localServerURL, setLocalServerURL] = useState(LOCAL_BACKEND);



    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [historyItems, setHistoryItems] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('moviebox_watch_history') || '[]');
        } catch (e) {
            return [];
        }
    });
    const [manualIPInput, setManualIPInput] = useState('');
    const [activeSource, setActiveSource] = useState(() => {
        // Default to 'home' which aggregates or shows default homepage
        return localStorage.getItem('moviebox_active_source') || 'home';
    });

    // Update localStorage when activeSource changes
    useEffect(() => {
        localStorage.setItem('moviebox_active_source', activeSource);
        // Clear results when switching sources to avoid mixing
        setResults([]);

        // If switching to home, we typically want to clear search and show aggregation
        // If switching to a specific source, we might auto-fetch its specific homepage variant
        setHomepageContent(null);

    }, [activeSource]);

    // Server discovery removed as backend is always local
    useEffect(() => {
        setLocalServerURL(LOCAL_BACKEND);
    }, []);

    // Helper to determine target base URL for a given source
    const getTargetBase = (src = activeSource) => {
        if (src === 'news') return NEWS_API_BASE;
        return LOCAL_BACKEND;
    };

    const API_BASE = getTargetBase(activeSource);

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null); // For DetailsModal
    const [videoPlayerData, setVideoPlayerData] = useState(null); // For WatchPage
    const [mangaReaderItem, setMangaReaderItem] = useState(null); // For MangaReader
    const [activeTrack, setActiveTrack] = useState(null); // For MusicPlayer
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [newsReaderItem, setNewsReaderItem] = useState(null);
    const [activeRadioStation, setActiveRadioStation] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [homepageContent, setHomepageContent] = useState(null);
    const [homepageLoading, setHomepageLoading] = useState(false);
    const [globalError, setGlobalError] = useState(null);

    useEffect(() => {
        const handleError = (event) => {
            setGlobalError(event.error?.message || event.message || "Unknown Error");
            console.error("Global Error:", event);
        };
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', (e) => {
            setGlobalError(e.reason?.message || "Promise Rejection");
        });
        return () => {
            window.removeEventListener('error', handleError);
        };
    }, []);

    // Server status (simple polling or just static 'operational' for now, can be updated by backend)
    const [serverStatus, setServerStatus] = useState('operational');


    useEffect(() => {
        // Just a simple status check simulation
        setServerStatus('operational');

        const fetchHomepage = async (retryCount = 0) => {
            if (API_BASE === null) return;

            // Don't fetch homepage if we are in 'cinecli' or search mode (unless implemented)
            if (activeSource === 'cinecli') {
                setHomepageContent([]); // Placeholder for CineCLI home
                return;
            }

            setHomepageLoading(true);
            try {
                // Determine endpoint based on source
                let endpoint = '/api/homepage';
                if (activeSource === 'manga') endpoint = '/api/manga/search?query=Top';
                if (activeSource === 'anilist') endpoint = '/api/anime/home';
                if (activeSource === 'music') endpoint = '/api/music/home';
                if (activeSource === 'news') {
                    // Fetch directly from local Consumet service
                    const newsRes = await fetch(`${API_BASE}/api/news/ann/recent-feeds`);
                    if (newsRes.ok) {
                        const newsData = await newsRes.json();
                        const items = Array.isArray(newsData) ? newsData : (newsData.results || newsData.items || []);
                        setHomepageContent([{ title: 'Latest Anime & Manga News', items: items, type: 'news' }]);
                        setHomepageLoading(false);
                        return;
                    }
                }

                const res = await fetch(`${API_BASE}${endpoint}`);
                if (res.ok) {
                    const data = await res.json();
                    if (activeSource === 'moviebox' || activeSource === 'home') {
                        setHomepageContent(data.groups.map(g => ({
                            ...g,
                            items: g.items.map(it => ({ ...it, source: 'moviebox' }))
                        })));
                    } else if (activeSource === 'anilist') {
                        setHomepageContent(data);
                    } else if (activeSource === 'manga') {
                        const results = Array.isArray(data) ? data : (data.results || []);
                        setHomepageContent([{
                            title: 'Popular Manga',
                            items: results.map(it => ({
                                ...it,
                                source: 'manga',
                                poster_url: `${API_BASE}/api/manga/image-proxy?url=${encodeURIComponent(it.poster_url)}`
                            }))
                        }]);
                    } else if (activeSource === 'tv') {
                        setHomepageContent([{ title: 'Live TV', items: [], _tvWelcome: true }]);
                    } else if (activeSource === 'music') {
                        if (data.groups) setHomepageContent(data.groups);
                    }
                    setHomepageLoading(false);
                } else if (retryCount < 4) {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch (err) {
                if (retryCount < 4) {
                    // Wait 2s and retry
                    setTimeout(() => fetchHomepage(retryCount + 1), 2000);
                    return;
                }
                setHomepageContent([]); // Clear homepage content on error after retries
                setHomepageLoading(false);
            }
        };

        // Added this simple check to prevent infinity loop if activeSource doesn't change
        // Only fetch if homepageContent is null (when changing sources it's set to null)
        if (homepageContent === null) {
            fetchHomepage();
        }

    }, [API_BASE, activeSource, homepageContent]);



    React.useEffect(() => {
        let ws;
        let reconnectTimeout;
        let didUnmount = false;

        const connect = () => {
            if (didUnmount) return;
            const wsUrl = API_BASE
                ? API_BASE.replace(/^http/, 'ws') + '/api/ws'
                : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/api/ws';

            try {
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    // Silent connection
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.status === 'downloading') {
                            setDownloadProgress(data.progress);
                        } else if (data.status === 'completed') {
                            setDownloadProgress(null);
                            alert('Download Complete!');
                        } else if (data.status === 'error') {
                            setDownloadProgress(null);
                            alert(`Error: ${data.message}`);
                        }
                    } catch (e) {
                        // Silent error
                    }
                };

                ws.onclose = () => {
                    if (!didUnmount) {
                        // Use a longer backoff (30s) for non-local URLs to reduce console spam on cloud backends
                        const isCloud = API_BASE && (API_BASE.includes('render.com') || API_BASE.includes('ngrok') || API_BASE.includes('loca.lt'));
                        const delay = isCloud ? 30000 : 5000;
                        reconnectTimeout = setTimeout(connect, delay);
                    }
                };

                ws.onerror = () => {
                    if (ws) ws.close();
                };
            } catch (err) {
                if (!didUnmount) {
                    const isCloud = API_BASE && (API_BASE.includes('render.com') || API_BASE.includes('ngrok'));
                    const delay = isCloud ? 30000 : 5000;
                    reconnectTimeout = setTimeout(connect, delay);
                }
            }
        };

        connect();

        return () => {
            didUnmount = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                ws.onopen = null;
                // Only close if it's OPEN
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    // Force close if it's connecting
                    ws.close();
                }
            }
        };
    }, [API_BASE]); // Re-connect when API_BASE changes

    const handleSearch = async (query, type = 'all') => {
        // TV section has its own built-in filter — don't run global search
        if (activeSource === 'tv') return;

        setLoading(true);
        try {
            // Determine endpoint based on activeSource
            // 'home' -> searches moviebox by default or we could aggregate (stick to moviebox for now)
            // 'cinecli' -> Not implemented yet in backend, but we'll prepare for it

            let endpoint = `/api/search?query=${encodeURIComponent(query)}&content_type=${type}`;
            const base = getTargetBase(activeSource);

            if (activeSource === 'anilist') {
                endpoint = `/api/anime/search?query=${encodeURIComponent(query)}`;
            } else if (activeSource === 'cinecli') {
                endpoint = `/api/cinecli/search?query=${encodeURIComponent(query)}`;
            } else if (activeSource === 'manga') {
                endpoint = `/api/manga/search?query=${encodeURIComponent(query)}`;
            } else if (activeSource === 'music') { // Added music search logic
                endpoint = `/api/music/search?query=${encodeURIComponent(query)}`;
            }

            const res = await fetch(`${base}${endpoint}`);
            const data = await res.json();

            if (activeSource === 'anilist') {
                // Backend already normalizes anime results
                setResults(Array.isArray(data) ? data : []);
            } else if (activeSource === 'manga') {
                setResults((data.results || []).map(it => ({
                    ...it,
                    source: 'manga',
                    poster_url: `${base}/api/manga/image-proxy?url=${encodeURIComponent(it.poster_url)}`
                })));
            } else if (activeSource === 'music') {
                setResults((data.results || []).map(it => {
                    let determinedType = it.type;
                    if (typeof it.type !== 'string') {
                        determinedType = it.type === 2 ? 'series' : 'movie';
                    }
                    return { ...it, source: 'moviebox', type: determinedType };
                }));
            } else {
                // Default search results (Home / MovieBox)
                const items = Array.isArray(data.results) ? data.results : (data.items || []);
                setResults(items.map(it => ({ ...it, source: 'moviebox' })));
            }
        } catch (err) {
            console.error("Search failed", err);
            // Detailed error alerting with Cold Start explanation
            const isColdStart = err.message === 'Failed to fetch' || err.message.includes('timeout');
            const coldStartMsg = isColdStart ? "\n\nNote: This might be a 'Cold Start'. Render servers sleep after inactivity. Please wait 30 seconds and try again." : "";
            alert(`Connection Failed!\n\nError: ${err.message}${coldStartMsg}\n\nPlease ensure your backend is reachable.`);
        } finally {
            setLoading(false);
        }
    };

    const handleMusicPlay = async (item) => {
        setDetailsLoading(true);
        try {
            const base = getTargetBase(activeSource);
            const res = await fetch(`${base}/api/music/info?seokey=${item.id}&type=${item.type || 'music'}`);
            const data = await res.json();

            let trackToPlay = data;
            if (item.type === 'music_playlist') {
                const tracks = data.tracks || (Array.isArray(data) ? data : []);
                if (tracks.length > 0) {
                    trackToPlay = tracks[0];
                    // Add source info if missing
                    if (!trackToPlay.source) trackToPlay.source = 'music';
                }
            }

            if (trackToPlay && trackToPlay.stream_url) {
                setActiveTrack(trackToPlay);
                setSelectedItem(null); // Close modal if open
            } else {
                alert("Could not play this track. Stream URL missing.");
            }
        } catch (e) {
            console.error("Failed to play music", e);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleItemClick = async (item) => {
        // Save to Watch History
        try {
            const h = JSON.parse(localStorage.getItem('moviebox_watch_history') || '[]');
            const newH = [item, ...h.filter(x => String(x.id) !== String(item.id))];
            localStorage.setItem('moviebox_watch_history', JSON.stringify(newH));
            setHistoryItems(newH);
        } catch (e) {
            console.error("Failed to save history", e);
        }

        const src = item.source || 'moviebox';
        // Set selected item immediately to preserve poster/metadata for the modal
        setSelectedItem({ ...item, source: src });

        // If it's a music item, handle based on type
        if (item.source === 'music' || item.type === 'music' || item.type === 'music_playlist') {
            if (item.type === 'music_playlist') {
                // For playlists, open details modal to select track
                navigate(`/details/${item.id}?source=music&type=music_playlist`);
            } else {
                // For single tracks, play directly
                handleMusicPlay(item);
            }
            return;
        }

        // Ensure we show loading state if details are missing (e.g. from History)
        const isComplete = (it) => {
            if (!it || !it.hasFullDetails) return false;
            const s = it.source || src;
            if (s === 'anilist') return it.animeEpisodes && it.animeEpisodes.length > 0;
            if (s === 'manga') return it.volumes && Object.keys(it.volumes).length > 0;
            if (s === 'novel') return it.volumes && Object.keys(it.volumes).length > 0;
            if (it.type === 'series' || it.type === 'anime') return it.seasons && it.seasons.length > 0;
            return !!(it.plot || it.description);
        };

        if (!isComplete(item)) {
            setDetailsLoading(true);
        }

        // Encode ID for novel source since it might be a full URL
        const encodedId = src === 'novel' ? encodeURIComponent(item.id) : item.id;

        // Navigate to details route; router will load remaining details (like chapters/episodes)
        navigate(`/details/${encodedId}?source=${encodeURIComponent(src)}&type=${item.type || 'movie'}`);
    };

    const handleDownload = async (item, season = null, episode = null, url = null) => {
        // If we already have a direct URL (e.g. from CineCLI magnet or explicit file)
        if (url) {
            window.location.href = url;
            return;
        }

        // For Music items
        if (item.source === 'music') {
            try {
                const base = getTargetBase(activeSource);
                const res = await fetch(`${base}/api/music/info?seokey=${item.id}&type=${item.type || 'music'}`);
                const data = await res.json();
                let track = data;
                if (item.type === 'music_playlist' && data.tracks) track = data.tracks[0];

                if (track && track.stream_url) {
                    const proxyUrl = `${base}/api/proxy/download?url=${encodeURIComponent(track.stream_url)}&filename=${encodeURIComponent(track.title + (track.stream_url.includes('.m3u8') ? '.m3u8' : '.mp3'))}`;
                    window.location.href = proxyUrl;
                }
            } catch (err) {
                console.error("Music download failed", err);
            }
            return;
        }

        // For MovieBox items, we need to resolve the stream URL first
        try {
            // 1. Fetch the stream URL from backend
            // Determine appropriate base URL for this specific item
            const base = getTargetBase(item.source);

            // Let's try to fetch details which usually contains 'streams' or 'sources'.
            const res = await fetch(`${base}/api/details/${item.id}?type=${item.type || 'movie'}`);
            const data = await res.json();

            let streamUrl = null;
            if (data.streams && data.streams.length > 0) {
                streamUrl = data.streams[0].url;
            } else if (data.sources && data.sources.length > 0) {
                streamUrl = data.sources[0].url;
            }

            if (streamUrl) {
                // 2. Redirect to Proxy Download
                const proxyUrl = `${base}/api/proxy/download?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(item.title + '.mp4')}`;
                window.location.href = proxyUrl;
            } else {
                alert("Could not resolve a download link for this item.");
            }

        } catch (err) {
            console.error("Download resolution failed", err);
            alert("Failed to start download");
        }
    };

    // Use a ref to prevent double-execution of streams (e.g. StrictMode or ghost clicks)
    const streamGuardRef = React.useRef(null);
    const handleStream = async (item, season = null, episode = null) => {
        if (!item) return;

        // Simple debounce guard
        const now = Date.now();
        if (streamGuardRef.current && streamGuardRef.current.id === item.id && (now - streamGuardRef.current.time < 500)) {
            return;
        }
        streamGuardRef.current = { id: item.id, time: now };

        if (item.source === 'music' || item.type === 'music' || item.type === 'music_playlist') {
            handleMusicPlay(item);
            return;
        }

        if (item.type === 'manga') {
            setMangaReaderItem({ item, chapterId: item.chapterId, chapterTitle: item.chapterTitle });
            return;
        }

        if (item.type === 'novel') {
            setNovelReaderItem({ item, chapterId: item.chapterId, chapterTitle: item.chapterTitle });
            return;
        }

        // console.log("[App] handleStream called for:", item && item.title);

        // Determine episode value from explicit arg or from item payload (HiAnime uses episodeNo/episodeId)
        let epValue = null;
        if (episode !== null && episode !== undefined) epValue = episode;
        else if (item && (item.episodeNo !== undefined && item.episodeNo !== null)) epValue = item.episodeNo;
        else if (item && (item.episode !== undefined && item.episode !== null)) epValue = item.episode;

        const src = (item && item.source) ? item.source : 'moviebox';

        // Pre-populate watchItem so the Watch UI appears immediately (avoid flashing Home)
        const preload = {
            item: { ...item, source: src },
            season: season || null,
            episode: episode || null,
            animeEpisodes: item && item.animeEpisodes ? item.animeEpisodes : null
        };
        // Navigate to watch route with episode and source params
        const params = new URLSearchParams();
        if (episode !== null && episode !== undefined) params.set('episode', String(episode));
        if (season !== null && season !== undefined) params.set('season', String(season));
        params.set('source', src);

        // For TV channels, pass the stream URL and type in the query so loadWatch can reconstruct state
        if (src === 'tv') {
            if (item.url) params.set('url', item.url);
            if (item.stream_type) params.set('stream_type', item.stream_type);
            if (item.title) params.set('title', item.title);
            if (item.yt_id) params.set('yt_id', item.yt_id);
        }

        internalNavRef.current = true;
        setVideoPlayerData(preload);

        const watchUrl = `/watch/${encodeURIComponent(item.id)}?${params.toString()}`;
        // console.log("[App] handleStream navigating to:", watchUrl);
        navigate(watchUrl);

        // ALWAYS close modal manually upon streaming to avoid UI overlap
        setSelectedItem(null);
    };


    const handleRemoveHistoryItem = (e, id) => {
        e.stopPropagation();
        try {
            const newH = historyItems.filter(x => String(x.id) !== String(id));
            localStorage.setItem('moviebox_watch_history', JSON.stringify(newH));
            setHistoryItems(newH);
        } catch (err) {
            console.error("Failed to remove history item", err);
        }
    };

    useEffect(() => {
        try {
            // Keep UI in sync with React Router location
            const pathname = location.pathname || '/';
            const search = location.search || '';

            const loadDetails = async (id, source, type = 'movie') => {
                // TV channels don't have a details page — just clear state
                if (source === 'tv') {
                    setDetailsLoading(false);
                    return;
                }
                // If loadDetails is called, it means we definitely need to fetch more data.
                // We set detailsLoading(true) to show the prominent spinner.
                setDetailsLoading(true);

                console.log(`[App] loadDetails starting for ID: ${id}, Source: ${source}`);
                // Determine appropriate base URL for this source
                const base = getTargetBase(source);
                console.log(`[App] Using base URL for fetch: ${base}`);

                try {
                    if (source === 'cinecli') {
                        const res = await fetch(`${base}/api/cinecli/details/${id}`);
                        const details = await res.json();
                        setSelectedItem(prev => ({ ...(prev || {}), ...details, source: 'cinecli', hasFullDetails: true }));
                    } else if (source === 'anilist') {
                        let details = {};
                        let episodes = [];
                        try {
                            const dTask = fetch(`${base}/api/anime/details/${id}`).then(r => r.ok ? r.json() : {});
                            const eTask = fetch(`${base}/api/anime/episodes/${id}`).then(r => r.ok ? r.json() : {});
                            const [d, e] = await Promise.all([dTask, eTask]);
                            details = d;
                            if (e.status === 200 && e.data) episodes = e.data.episodes || [];
                        } catch (e) { /* ignore */ }

                        setSelectedItem(prev => ({
                            ...(prev || {}),
                            ...(details.id ? details : { id, title: details.title || (prev && prev.title) || '' }),
                            animeEpisodes: episodes,
                            type: 'anime',
                            source: 'anilist',
                            hasFullDetails: true
                        }));
                    } else if (source === 'manga') {
                        const res = await fetch(`${base}/api/manga/details/${id}`);
                        const details = await res.json();
                        setSelectedItem(prev => {
                            const rawPoster = details.poster_url || details.poster || details.image;
                            let finalPoster = prev?.poster_url || null;

                            if (rawPoster && typeof rawPoster === 'string') {
                                if (rawPoster.includes('/api/manga/image-proxy')) {
                                    finalPoster = rawPoster;
                                } else if (rawPoster.startsWith('http') || rawPoster.startsWith('//')) {
                                    const fullUrl = rawPoster.startsWith('//') ? `https:${rawPoster}` : rawPoster;
                                    finalPoster = `${base}/api/manga/image-proxy?url=${encodeURIComponent(fullUrl)}`;
                                } else {
                                    finalPoster = rawPoster;
                                }
                            }

                            return {
                                ...(prev || {}),
                                ...details,
                                source: 'manga',
                                type: 'manga',
                                poster_url: finalPoster || prev?.poster_url,
                                hasFullDetails: true
                            };
                        });
                    } else if (source === 'music') {
                        const res = await fetch(`${base}/api/music/info?seokey=${id}&type=${type}`);
                        const details = await res.json();
                        setSelectedItem(prev => ({
                            ...(prev || {}),
                            ...details,
                            source: 'music',
                            type: type || 'music',
                            hasFullDetails: true
                        }));
                    } else {
                        const res = await fetch(`${base}/api/details/${id}?type=${type}`);
                        const details = await res.json();
                        setSelectedItem(prev => ({ ...(prev || {}), ...details, source: 'moviebox', hasFullDetails: true }));
                    }
                } catch (e) {
                    console.error('Failed to load details for route', e);
                } finally {
                    setDetailsLoading(false);
                }
            };

            const loadWatch = async (id, ep, source = 'moviebox', season = null) => {
                console.log("[App] loadWatch triggered for:", id, "Source:", source);
                try {
                    let details = { id, source }; // Default with known info
                    if (source === 'anilist') {
                        // HiAnime: fetch details and episodes then set player to use embed flow
                        const base = getTargetBase(source);
                        try {
                            const dRes = await fetch(`${base}/api/anime/details/${id}`);
                            if (dRes.ok) details = await dRes.json();
                        } catch (e) { /* ignore */ }

                        let episodes = [];
                        try {
                            const eRes = await fetch(`${base}/api/anime/episodes/${id}`);
                            const eData = await eRes.json();
                            if (eData.status === 200 && eData.data) episodes = eData.data.episodes || [];
                        } catch (e) { /* ignore */ }

                        // Provide enough info for WatchPage to construct embed URL / episodeId mapping
                        const item = { ...details, id, source: 'anilist', type: 'anime', hasFullDetails: true };
                        setVideoPlayerData({ item, season: season || null, episode: ep || null, animeEpisodes: episodes });
                        setSelectedItem(null);
                        return;
                    }

                    // TV channels: no details endpoint, just play directly
                    if (source === 'tv') {
                        const params = new URLSearchParams(location.search);
                        const url = params.get('url');
                        const ytId = params.get('yt_id');
                        const streamType = params.get('stream_type') || 'hls';
                        // Decode title — it was encoded with encodeURIComponent
                        const rawTitle = params.get('title') || '';
                        const title = rawTitle || id;
                        // console.log("[App] loadWatch TV data reconstructed:", { id, url, title, ytId });
                        setVideoPlayerData({
                            item: { id, source: 'tv', type: 'channel', url, stream_type: streamType, title, yt_id: ytId },
                            season: null,
                            episode: null
                        });
                        setSelectedItem(null);
                        return;
                    }

                    // Default MovieBox flow
                    const base = getTargetBase(source);
                    const res = await fetch(`${base}/api/details/${id}`);
                    if (res.ok) {
                        const d = await res.json();
                        const item = { ...d, id, source, type: (d.type || 'movie'), hasFullDetails: true };
                        setVideoPlayerData({ item, season: season || null, episode: ep || null });
                        setSelectedItem(null);
                    } else {
                        setVideoPlayerData({ item: { id, source, type: 'movie' }, season: season || null, episode: ep || null });
                    }
                } catch (e) {
                    setVideoPlayerData({ item: { id, source, type: 'movie' }, season: season || null, episode: ep || null });
                }
            };

            // Route handling
            // console.log("[App] Route Sync Hook triggered. Path:", pathname, "Params:", search);

            // Group route handlers to avoid clearing state during transitions
            if (pathname.startsWith('/details/')) {
                // Guard: If we are navigating TOWARDS a player/reader, don't clear state or reload details.
                if (internalNavRef.current) {
                    internalNavRef.current = false; // Reset now that we are at the route 
                    return;
                }

                const rawId = pathname.replace('/details/', '').split('?')[0];
                const id = decodeURIComponent(rawId);
                const params = new URLSearchParams(search);
                const source = params.get('source') || 'moviebox';
                const type = params.get('type') || 'movie';

                // Sync activeSource state if it differs from the URL (handles deep-linking)
                if (source !== activeSource && source !== 'home' && activeSource !== 'history') {
                    setActiveSource(source);
                }

                let effectiveItem = selectedItem;

                // First check if it's already in active state (e.g. from Reader/Player)
                if (videoPlayerData && String(videoPlayerData.item.id) === String(id)) {
                    setSelectedItem(null); // Ensure modal is closed when watching/reading
                    effectiveItem = videoPlayerData.item;
                } else if (mangaReaderItem && String(mangaReaderItem.item.id) === String(id)) {
                    setSelectedItem(mangaReaderItem.item);
                    effectiveItem = mangaReaderItem.item;
                }

                // Ensure other main views are cleared when viewing details
                setVideoPlayerData(null);
                setMangaReaderItem(null);
                setNewsReaderItem(null);

                // Determine if the item is "full enough" for the requested ID
                const isFullItem = (it) => {
                    if (!it || String(it.id) !== String(id)) return false;
                    if (!it.hasFullDetails) return false;

                    // Source-specific checks
                    if (source === 'anilist') return it.animeEpisodes && it.animeEpisodes.length > 0;
                    if (source === 'manga') return it.volumes && Object.keys(it.volumes || {}).length > 0;
                    if (source === 'music') return (it.tracks?.length > 0) || (it.songs?.length > 0);
                    if (it.type === 'series' || it.type === 'anime') return it.seasons && it.seasons.length > 0;

                    return !!(it.plot || it.description);
                };

                if (!isFullItem(effectiveItem)) {
                    loadDetails(id, source, type);
                }
                return;
            }

            if (pathname.startsWith('/watch/')) {
                internalNavRef.current = false; // Destination reached
                const id = pathname.replace('/watch/', '').split('/')[0];
                const params = new URLSearchParams(search);
                const ep = params.get('episode');
                const season = params.get('season');
                const source = params.get('source') || 'moviebox';

                if (source !== activeSource && source !== 'home' && activeSource !== 'history') {
                    setActiveSource(source);
                }

                const shouldReload = !videoPlayerData ||
                    String(videoPlayerData.item.id) !== String(id) ||
                    String(videoPlayerData.episode) !== String(ep);

                setSelectedItem(null);
                if (shouldReload) {
                    loadWatch(id, ep, source, season);
                }
                return;
            }

            // Fallback for Home/Root
            if (pathname === '/' || pathname === '' || pathname === '/home') {
                if (internalNavRef.current) {
                    internalNavRef.current = false;
                    return;
                }
                setSelectedItem(null);
                setVideoPlayerData(null);
                setMangaReaderItem(null);
                setNewsReaderItem(null);
                return;
            }

            // Reset guard if we are on any other route
            internalNavRef.current = false;
        } catch (err) {
            console.error("[App] Routing effect crashed:", err);
        }
    }, [location, API_BASE]);

    return (
        <div className="app" style={{ display: 'flex', flexDirection: 'row', maxWidth: '100vw', overflow: 'hidden' }}>

            {/* NEW SIDEBAR */}
            <Sidebar
                activeSource={activeSource}
                onChangeSource={setActiveSource}
                serverStatus={serverStatus}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', position: 'relative' }}>

                {/* Header Controls */}
                <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '2rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    zIndex: 200, // Higher than search bar
                    pointerEvents: 'none' // Let clicks pass through empty space
                }}>





                </div>


                <main className="container" style={{ paddingTop: '1rem' }}>

                    {/* NORMAL TOP SEARCH BAR */}
                    {activeSource !== 'history' && activeSource !== 'tv' && activeSource !== 'radio' && activeSource !== 'news' && (
                        <div style={{ padding: '1rem 0 2rem 0', display: 'flex', justifyContent: 'center' }}>
                            <SearchBar
                                onSearch={handleSearch}
                                placeholder={
                                    activeSource === 'music' ? 'Search tracks or playlists...' :
                                        activeSource === 'manga' ? "Search manga titles..." :
                                            activeSource === 'anilist' ? "Search anime titles..." :
                                                'Search movies, TV shows, anime, manga...'}
                            />
                        </div>
                    )}

                    {activeSource === 'history' && (
                        <div style={{ padding: '1rem 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['all', 'moviebox', 'anilist', 'manga', 'music'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setHistoryFilter(f)}
                                            style={{
                                                padding: '0.5rem 1.2rem',
                                                borderRadius: '20px',
                                                border: '1px solid var(--border-glass)',
                                                background: historyFilter === f ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                color: historyFilter === f ? '#fff' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                textTransform: 'capitalize',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {f === 'anilist' ? 'Anime' : f}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to clear your entire history?")) {
                                            localStorage.removeItem('moviebox_watch_history');
                                            window.location.reload();
                                        }
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    Clear All
                                </button>
                            </div>

                            <div className="movie-card-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '2rem'
                            }}>
                                {(() => {
                                    const filtered = historyItems.filter(item => historyFilter === 'all' || item.source === historyFilter);

                                    if (filtered.length === 0) return (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                            No history found for this category.
                                        </div>
                                    );

                                    return filtered.map((item, idx) => (
                                        <div key={`history-wrapper-${item.id}-${idx}`} style={{ position: 'relative' }} className="history-item-container">
                                            {item.source === 'music' ?
                                                <MusicCard movie={item} onClick={handleItemClick} /> :
                                                <MovieCard movie={item} onClick={handleItemClick} />
                                            }
                                            <button
                                                onClick={(e) => handleRemoveHistoryItem(e, item.id)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '12px',
                                                    right: '12px',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'rgba(0,0,0,0.8)',
                                                    border: '1px solid rgba(255,255,255,0.4)',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    zIndex: 100,
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    fontSize: '16px',
                                                    opacity: 0.7,
                                                    backdropFilter: 'blur(8px)',
                                                    pointerEvents: 'auto'
                                                }}
                                                className="remove-history-btn"
                                                title="Remove from history"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>
                            <div className="spinner" style={{
                                width: '50px', height: '50px',
                                border: '3px solid rgba(255,255,255,0.1)',
                                borderTopColor: 'var(--primary)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                            }}></div>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    <div className="movie-card-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '2rem',
                        paddingBottom: '4rem'
                    }}>
                        {(Array.isArray(results) ? results : []).map((item) => (
                            item && item.id ? (
                                item.source === 'music' ?
                                    <MusicCard key={item.id} movie={item} onClick={handleItemClick} /> :
                                    <MovieCard key={item.id} movie={item} onClick={handleItemClick} />
                            ) : null
                        ))}
                    </div>

                    {activeSource === 'tv' && results.length === 0 && (
                        <TVDiscovery API_BASE={API_BASE} onStream={handleStream} />
                    )}

                    {activeSource === 'radio' && results.length === 0 && (
                        <RadioDiscovery API_BASE={API_BASE} onStream={(station) => setActiveRadioStation(station)} />
                    )}

                    {results.length === 0 && !loading && activeSource !== 'history' && activeSource !== 'tv' && activeSource !== 'radio' && (
                        <>
                            {homepageLoading ? (
                                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                    <div className="spinner" style={{
                                        width: '30px', height: '30px',
                                        border: '2px solid rgba(255,255,255,0.1)',
                                        borderTopColor: 'var(--primary)',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto 1rem auto'
                                    }}></div>
                                    Loading trending content...
                                </div>
                            ) : homepageContent && homepageContent.length > 0 ? (
                                <div style={{ paddingBottom: '4rem' }}>
                                    {homepageContent.map((group, index) => (
                                        group._tvWelcome ? (
                                            <TVDiscovery key={index} API_BASE={API_BASE} onStream={handleStream} />
                                        ) : group._radioWelcome ? (
                                            <RadioDiscovery key={index} API_BASE={API_BASE} onStream={(station) => setActiveRadioStation(station)} />
                                        ) : (
                                            <div key={index} style={{ marginBottom: '4rem', animation: 'fadeIn 0.6s var(--ease-out) forwards' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    marginBottom: '2rem',
                                                    paddingLeft: '0.5rem'
                                                }}>
                                                    <div style={{ width: '6px', height: '32px', background: 'var(--primary-gradient)', borderRadius: '4px' }}></div>
                                                    <h2 style={{
                                                        fontSize: '1.8rem',
                                                        fontWeight: '800',
                                                        background: 'linear-gradient(to right, #fff, #94a3b8)',
                                                        WebkitBackgroundClip: 'text',
                                                        WebkitTextFillColor: 'transparent',
                                                        letterSpacing: '-0.5px'
                                                    }}>
                                                        {group.title}
                                                    </h2>
                                                </div>
                                                <div className={group.type === 'news' ? "news-grid" : "movie-card-grid"} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: group.type === 'news' ? 'repeat(auto-fill, minmax(300px, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))',
                                                    gap: '2rem'
                                                }}>
                                                    {group.items.map((item, idx) => (
                                                        group.type === 'news' ?
                                                            <NewsCard key={item.id || idx} item={item} onClick={(it) => setNewsReaderItem(it)} API_BASE={CLOUD_BASE} /> :
                                                            (activeSource === 'music' ?
                                                                <MusicCard key={`${item.id}-${index}-${idx}`} movie={item} onClick={handleItemClick} /> :
                                                                <MovieCard key={`${item.id}-${index}-${idx}`} movie={item} onClick={handleItemClick} />)
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem', padding: '2rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                                    {activeSource === 'cinecli' ? (
                                        <div>
                                            <h3>CineCLI Integration Ready</h3>
                                            <p>Search for torrents using the search bar above.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p style={{ fontSize: '1.2rem' }}>Start by searching for content.</p>
                                            <p style={{ fontSize: '0.9rem', marginTop: '1rem', opacity: 0.7 }}>
                                                Connected to: {API_BASE}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {
                selectedItem && !mangaReaderItem && (
                    <DetailsModal
                        item={selectedItem}
                        onClose={() => {
                            setSelectedItem(null);
                            setDetailsLoading(false); // Reset loading state
                            navigate('/');
                        }}
                        onDownload={handleDownload}
                        onStream={handleStream}
                        onLanguageChange={(newLanguage) => {
                            // Extract base title and search for new language version
                            const baseTitle = selectedItem.title.replace(/\[.*?\]/g, '').trim();
                            const searchQuery = `${baseTitle} [${newLanguage}]`;
                            setSelectedItem(null); // Close modal
                            handleSearch(searchQuery, selectedItem.type); // Trigger search
                        }}
                        progress={downloadProgress}
                        serverMode="local"
                        API_BASE={getTargetBase(selectedItem.source)}
                        detailsLoading={detailsLoading}
                    />
                )
            }

            {/* In-App Watch Page */}
            {videoPlayerData && (
                <WatchPage
                    key={`watch-${videoPlayerData.item.id}`}
                    item={videoPlayerData.item}
                    initialSeason={videoPlayerData.season}
                    initialEpisode={videoPlayerData.episode}
                    API_BASE={getTargetBase(videoPlayerData.item.source)}
                    onBack={() => {
                        const item = videoPlayerData.item;
                        const src = item && item.source ? item.source : 'moviebox';
                        // TV channels should go back to the TV section, not open DetailsModal
                        if (src === 'tv') {
                            setVideoPlayerData(null);
                            navigate('/');
                        } else {
                            const type = item && item.type ? item.type : 'movie';
                            internalNavRef.current = true; // GUARD TRANSITION
                            setSelectedItem(item); // INSTANT RECOVERY
                            setVideoPlayerData(null); // INSTANT HIDE PLAYER
                            navigate(`/details/${item.id}?source=${encodeURIComponent(src)}&type=${encodeURIComponent(type)}`);
                        }
                    }}
                    preloadedEpisodes={videoPlayerData.animeEpisodes}
                />
            )}

            {mangaReaderItem && (
                <MangaReader
                    key={`manga-${mangaReaderItem.item.id}`}
                    item={mangaReaderItem.item}
                    chapterId={mangaReaderItem.chapterId}
                    chapterTitle={mangaReaderItem.chapterTitle}
                    API_BASE={API_BASE}
                    onBack={() => {
                        const item = mangaReaderItem.item;
                        const type = item && item.type ? item.type : 'manga';
                        const src = item && item.source ? item.source : 'manga';
                        internalNavRef.current = true; // GUARD TRANSITION
                        setSelectedItem(item); // INSTANT RECOVERY
                        setMangaReaderItem(null); // INSTANT HIDE READER
                        navigate(`/details/${item.id}?source=${encodeURIComponent(src)}&type=${encodeURIComponent(type)}`);
                    }}
                />
            )}


            {activeTrack && (
                <MusicPlayer
                    track={activeTrack}
                    onClose={() => setActiveTrack(null)}
                />
            )}

            {activeRadioStation && (
                <RadioPlayer
                    station={activeRadioStation}
                    onClose={() => setActiveRadioStation(null)}
                />
            )}

            {newsReaderItem && (
                <NewsReader
                    articleId={newsReaderItem.id}
                    onClose={() => setNewsReaderItem(null)}
                    API_BASE={NEWS_API_BASE}
                />
            )}


            {/* Manual IP Modal */}

            {globalError && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ef4444',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    zIndex: 9999,
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <span>⚠️ Error: {globalError}</span>
                    <button onClick={() => setGlobalError(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px', padding: '2px 6px' }}>Dismiss</button>
                    <button onClick={() => window.location.reload()} style={{ background: 'white', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '4px', padding: '2px 8px', fontWeight: 'bold' }}>Reload App</button>
                </div>
            )}
        </div>
    );
}

export default App;
