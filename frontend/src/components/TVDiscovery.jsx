import React, { useState, useEffect, useMemo } from 'react';

// ─── Famelack data source (plain JSON, same as Famelack uses internally) ─────
const FAMELACK_RAW = 'https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw';

// Parse a YouTube embed URL into a clean embed URL with autoplay
function cleanYoutubeEmbedUrl(url) {
    if (!url) return null;
    // Handle watch?v= format
    if (url.includes('youtube.com/watch?v=')) {
        const id = url.split('v=')[1]?.split('&')[0];
        url = `https://www.youtube.com/embed/${id}`;
    } else if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        url = `https://www.youtube.com/embed/${id}`;
    }

    // Normalize: use youtube.com (not nocookie) for better compatibility
    let cleanUrl = url.replace('www.youtube-nocookie.com', 'www.youtube.com')
        .replace('youtube-nocookie.com', 'www.youtube.com');
    
    // Add autoplay if not already present
    const separator = cleanUrl.includes('?') ? '&' : '?';
    if (!cleanUrl.includes('autoplay=')) cleanUrl += `${separator}autoplay=1`;
    if (!cleanUrl.includes('mute=')) cleanUrl += '&mute=0';
    return cleanUrl;
}

// ─── Component ────────────────────────────────────────────────────────────────
const TVDiscovery = ({ onStream, API_BASE = '' }) => {
    const [viewMode, setViewMode] = useState('countries');
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    // Sync global time for all clocks
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Custom Channels State ---
    const [userChannels, setUserChannels] = useState(() => {
        const saved = localStorage.getItem('genga_user_tv_channels');
        return saved ? JSON.parse(saved) : [];
    });
    const [showAddForm, setShowAddForm] = useState(false);
    const [newChanName, setNewChanName] = useState('');
    const [newChanUrl, setNewChanUrl] = useState('');

    // Persist user channels
    useEffect(() => {
        localStorage.setItem('genga_user_tv_channels', JSON.stringify(userChannels));
    }, [userChannels]);

    useEffect(() => {
        setSearchQuery('');
        setAllItems([]);
        setError(null);
        if (viewMode === 'countries') fetchCountries();
        else if (viewMode === 'channels' && selectedCountry) {
            if (selectedCountry.id === 'user_custom') {
                setAllItems(userChannels);
                setLoading(false);
            } else {
                fetchChannels(selectedCountry.id);
            }
        }
    }, [viewMode, selectedCountry, userChannels]);

    const fetchCountries = async (retryCount = 0) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/tv/countries`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            // Add "My Channels" as a virtual country if there are user channels
            const countries = data.results || [];
            const finalCountries = [
                { id: 'user_custom', title: '⭐ My Custom Channels', type: 'country' },
                ...countries
            ];
            setAllItems(finalCountries);
            setLoading(false);
        } catch (e) {
            console.warn(`TV fetch failed (attempt ${retryCount + 1}):`, e.message);
            if (retryCount < 5) {
                // Wait 1.5s and retry
                setTimeout(() => fetchCountries(retryCount + 1), 1500);
            } else {
                setError(`Could not load countries: ${e.message}`);
                setLoading(false);
            }
        }
    };

    const fetchChannels = async (code) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/tv/country/${code}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAllItems(data.results || []);
        } catch (e) {
            setError(`Could not load channels: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const items = useMemo(() => {
        if (!searchQuery.trim()) return allItems;
        const q = searchQuery.toLowerCase();
        return allItems.filter(item =>
            item.title?.toLowerCase().includes(q) ||
            item.name?.toLowerCase().includes(q)
        );
    }, [allItems, searchQuery]);

    const handleItemClick = (item) => {
        if (item.type === 'country') {
            setSelectedCountry(item);
            setViewMode('channels');
        } else {
            if (onStream) onStream(item);
        }
    };

    const handleAddChannel = (e) => {
        e.preventDefault();
        if (!newChanName || !newChanUrl) return;

        let streamType = 'hls';
        let finalUrl = newChanUrl;

        if (newChanUrl.includes('youtube.com') || newChanUrl.includes('youtu.be')) {
            streamType = 'embed';
            finalUrl = cleanYoutubeEmbedUrl(newChanUrl);
        } else if (newChanUrl.toLowerCase().endsWith('.m3u8') || newChanUrl.toLowerCase().includes('.m3u8?')) {
            streamType = 'hls';
        }

        const newChannel = {
            id: `user_${Date.now()}`,
            title: newChanName,
            poster_url: '',
            url: finalUrl,
            stream_type: streamType,
            source: 'tv',
            type: 'channel',
            is_user_added: true
        };

        setUserChannels(prev => [...prev, newChannel]);
        setNewChanName('');
        setNewChanUrl('');
        setShowAddForm(false);
    };

    const removeChannel = (id) => {
        setUserChannels(prev => prev.filter(c => c.id !== id));
    };

    const highlightMatch = (text, query) => {
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return (
            <>{text.substring(0, idx)}<span style={highlightStyle}>{text.substring(idx, idx + query.length)}</span>{text.substring(idx + query.length)}</>
        );
    };

    // ── Components ─────────────────────────────────────────────────────────────
    const CountryCard = ({ item }) => {
        const flagUrl = item.id === 'user_custom' ? null : `https://flagcdn.com/w160/${item.id.toLowerCase()}.png`;
        const flag = item.id === 'user_custom' ? '⭐' : '🌍';
        const parts = item.title.split(' ');
        const name = item.id === 'user_custom' ? item.title : (parts.slice(1).join(' ') || item.title);

        return (
            <div onClick={() => handleItemClick(item)} style={cardStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {flagUrl ? (
                        <img 
                            src={flagUrl} 
                            alt="" 
                            style={{ width: 80, height: 'auto', borderRadius: 4, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        />
                    ) : null}
                    <span style={{ fontSize: '3rem', display: flagUrl ? 'none' : 'block' }}>{flag}</span>
                </div>
                <span style={nameStyle}>{highlightMatch(name, searchQuery)}</span>
            </div>
        );
    };

    const ChannelCard = ({ item }) => {
        const [imgError, setImgError] = useState(false);
        return (
            <div style={{ position: 'relative' }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <div onClick={() => handleItemClick(item)} style={{ ...cardStyle, minHeight: '140px', justifyContent: 'center' }}>
                    <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.poster_url && !imgError ? (
                            <img src={item.poster_url} alt={item.title} onError={() => setImgError(true)}
                                style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8 }} />
                        ) : (
                            <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                                {item.title.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <span style={{ ...nameStyle, fontSize: '0.8rem', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {highlightMatch(item.title, searchQuery)}
                    </span>
                    <span style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10,
                        background: (item.stream_type === 'embed' || item.stream_type === 'youtube_hls')
                            ? 'rgba(255,0,0,0.15)' : 'rgba(34,197,94,0.15)',
                        color: (item.stream_type === 'embed' || item.stream_type === 'youtube_hls')
                            ? '#f87171' : '#22c55e',
                        border: `1px solid ${(item.stream_type === 'embed' || item.stream_type === 'youtube_hls')
                            ? 'rgba(255,0,0,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>{(item.stream_type === 'embed' || item.stream_type === 'youtube_hls') ? '▶ YouTube' : '🔴 Live'}</span>
                </div>
                {item.is_user_added && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeChannel(item.id); }}
                        style={deleteBtnStyle}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                )}
            </div>
        );
    };

    // --- Time Display Component ---
    const TimeDisplay = ({ timezone, countryCode }) => {
        const [currentTime, setCurrentTime] = useState(new Date());

        useEffect(() => {
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);
            return () => clearInterval(timer);
        }, []);

        const tzMap = {
            'af': 'Asia/Kabul', 'al': 'Europe/Tirane', 'dz': 'Africa/Algiers', 'as': 'Pacific/Pago_Pago', 'ad': 'Europe/Andorra',
            'ao': 'Africa/Luanda', 'ai': 'America/Anguilla', 'ag': 'America/Antigua', 'ar': 'America/Argentina/Buenos_Aires',
            'am': 'Asia/Yerevan', 'aw': 'America/Aruba', 'au': 'Australia/Sydney', 'at': 'Europe/Vienna', 'az': 'Asia/Baku',
            'bs': 'America/Nassau', 'bh': 'Asia/Bahrain', 'bd': 'Asia/Dhaka', 'bb': 'America/Barbados', 'by': 'Europe/Minsk',
            'be': 'Europe/Brussels', 'bz': 'America/Belize', 'bj': 'Africa/Porto-Novo', 'bm': 'Atlantic/Bermuda', 'bt': 'Asia/Thimphu',
            'bo': 'America/La_Paz', 'ba': 'Europe/Sarajevo', 'bw': 'Africa/Gaborone', 'br': 'America/Sao_Paulo', 'vg': 'America/St_Thomas',
            'bn': 'Asia/Brunei', 'bg': 'Europe/Sofia', 'bf': 'Africa/Ouagadougou', 'bi': 'Africa/Bujumbura', 'kh': 'Asia/Phnom_Penh',
            'cm': 'Africa/Douala', 'ca': 'America/Toronto', 'cv': 'Atlantic/Cape_Verde', 'ky': 'America/Cayman', 'cf': 'Africa/Bangui',
            'td': 'Africa/Ndjamena', 'cl': 'America/Santiago', 'cn': 'Asia/Shanghai', 'co': 'America/Bogota', 'km': 'Indian/Comoros',
            'cg': 'Africa/Brazzaville', 'cd': 'Africa/Kinshasa', 'ck': 'Pacific/Rarotonga', 'cr': 'America/Costa_Rica', 'hr': 'Europe/Zagreb',
            'cu': 'America/Havana', 'cy': 'Asia/Nicosia', 'cz': 'Europe/Prague', 'dk': 'Europe/Copenhagen', 'dj': 'Africa/Djibouti',
            'dm': 'America/Dominica', 'do': 'America/Santo_Domingo', 'ec': 'America/Guayaquil', 'eg': 'Africa/Cairo', 'sv': 'America/El_Salvador',
            'gq': 'Africa/Malabo', 'er': 'Africa/Asmara', 'ee': 'Europe/Tallinn', 'et': 'Africa/Addis_Ababa', 'fk': 'Atlantic/Stanley',
            'fo': 'Atlantic/Faroe', 'fj': 'Pacific/Fiji', 'fi': 'Europe/Helsinki', 'fr': 'Europe/Paris', 'gf': 'America/Cayenne',
            'pf': 'Pacific/Tahiti', 'ga': 'Africa/Libreville', 'gm': 'Africa/Banjul', 'ge': 'Asia/Tbilisi', 'de': 'Europe/Berlin',
            'gh': 'Africa/Accra', 'gi': 'Europe/Gibraltar', 'gr': 'Europe/Athens', 'gl': 'America/Nuuk', 'gd': 'America/Grenada',
            'gu': 'Pacific/Guam', 'gt': 'America/Guatemala', 'gn': 'Africa/Conakry', 'gw': 'Africa/Bissau', 'gy': 'America/Guyana',
            'ht': 'America/Port-au-Prince', 'hn': 'America/Tegucigalpa', 'hk': 'Asia/Hong_Kong', 'hu': 'Europe/Budapest', 'is': 'Atlantic/Reykjavik',
            'in': 'Asia/Kolkata', 'id': 'Asia/Jakarta', 'ir': 'Asia/Tehran', 'iq': 'Asia/Baghdad', 'ie': 'Europe/Dublin', 'il': 'Asia/Jerusalem',
            'it': 'Europe/Rome', 'jm': 'America/Jamaica', 'jp': 'Asia/Tokyo', 'jo': 'Asia/Amman', 'kz': 'Asia/Almaty', 'ke': 'Africa/Nairobi',
            'ki': 'Pacific/Tarawa', 'kp': 'Asia/Pyongyang', 'kr': 'Asia/Seoul', 'kw': 'Asia/Kuwait', 'kg': 'Asia/Bishkek', 'la': 'Asia/Vientiane',
            'lv': 'Europe/Riga', 'lb': 'Asia/Beirut', 'ls': 'Africa/Maseru', 'lr': 'Africa/Monrovia', 'ly': 'Africa/Tripoli', 'li': 'Europe/Vaduz',
            'lt': 'Europe/Vilnius', 'lu': 'Europe/Luxembourg', 'mo': 'Asia/Macau', 'mg': 'Indian/Antananarivo', 'mw': 'Africa/Blantyre',
            'my': 'Asia/Kuala_Lumpur', 'mv': 'Indian/Maldives', 'ml': 'Africa/Bamako', 'mt': 'Europe/Malta', 'mh': 'Pacific/Majuro',
            'mq': 'America/Martinique', 'mr': 'Africa/Nouakchott', 'mu': 'Indian/Mauritius', 'yt': 'Indian/Mayotte', 'mx': 'America/Mexico_City',
            'fm': 'Pacific/Pohnpei', 'md': 'Europe/Chisinau', 'mc': 'Europe/Monaco', 'mn': 'Asia/Ulaanbaatar', 'me': 'Europe/Podgorica',
            'ms': 'America/Montserrat', 'ma': 'Africa/Casablanca', 'mz': 'Africa/Maputo', 'mm': 'Asia/Yangon', 'na': 'Africa/Windhoek',
            'nr': 'Pacific/Nauru', 'np': 'Asia/Kathmandu', 'nl': 'Europe/Amsterdam', 'nc': 'Pacific/Noumea', 'nz': 'Pacific/Auckland',
            'ni': 'America/Managua', 'ne': 'Africa/Niamey', 'ng': 'Africa/Lagos', 'nu': 'Pacific/Niue', 'nf': 'Pacific/Norfolk',
            'mk': 'Europe/Skopje', 'mp': 'Pacific/Saipan', 'no': 'Europe/Oslo', 'om': 'Asia/Muscat', 'pk': 'Asia/Karachi', 'pw': 'Pacific/Palau',
            'ps': 'Asia/Gaza', 'pa': 'America/Panama', 'pg': 'Pacific/Port_Moresby', 'py': 'America/Asuncion', 'pe': 'America/Lima',
            'ph': 'Asia/Manila', 'pn': 'Pacific/Pitcairn', 'pl': 'Europe/Warsaw', 'pt': 'Europe/Lisbon', 'pr': 'America/Puerto_Rico',
            'qa': 'Asia/Qatar', 're': 'Indian/Reunion', 'ro': 'Europe/Bucharest', 'si': 'Europe/Ljubljana', 'sb': 'Pacific/Honiara', 
            'es': 'Europe/Madrid', 'lk': 'Asia/Colombo', 'sd': 'Africa/Khartoum', 'sr': 'America/Paramaribo', 'sz': 'Africa/Mbabane',
            'se': 'Europe/Stockholm', 'ch': 'Europe/Zurich', 'sy': 'Asia/Damascus', 'tw': 'Asia/Taipei', 'tj': 'Asia/Dushanbe',
            'tz': 'Africa/Dar_es_Salaam', 'th': 'Asia/Bangkok', 'tg': 'Africa/Lome', 'tk': 'Pacific/Fakaofo', 'to': 'Pacific/Tongatapu',
            'tt': 'America/Port_of_Spain', 'tn': 'Africa/Tunis', 'tr': 'Europe/Istanbul', 'tm': 'Asia/Ashgabat', 'tc': 'America/Grand_Turk',
            'tv': 'Pacific/Funafuti', 'ug': 'Africa/Kampala', 'ua': 'Europe/Kiev', 'ae': 'Asia/Dubai', 'gb': 'Europe/London', 'uk': 'Europe/London',
            'us': 'America/New_York', 'uy': 'America/Montevideo', 'uz': 'Asia/Tashkent', 'vu': 'Pacific/Efate', 'va': 'Europe/Vatican',
            've': 'America/Caracas', 'vn': 'Asia/Ho_Chi_Minh', 'wf': 'Pacific/Wallis', 'ye': 'Asia/Aden', 'zm': 'Africa/Lusaka', 'zw': 'Africa/Harare'
        };

        const tz = timezone || tzMap[countryCode?.toLowerCase()];
        if (!tz) return null;

        try {
            const localTime = currentTime.toLocaleTimeString('en-US', {
                timeZone: tz,
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });
            return (
                <div style={{ padding: '6px 14px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 12, color: '#fff', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                    <span style={{ fontSize: '1.2rem' }}>🕒</span> {localTime}
                </div>
            );
        } catch (e) { return null; }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const parts = selectedCountry?.title?.split(' ') || [];
    const name = selectedCountry?.id === 'user_custom' ? selectedCountry?.title : (parts.slice(1).join(' ') || selectedCountry?.title);

    return (
        <div style={{ padding: '20px 40px', minHeight: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                {viewMode === 'channels' && (
                    <button onClick={() => { setViewMode('countries'); setSelectedCountry(null); }} style={backBtnStyle}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        Back
                    </button>
                )}
                <div style={{ flex: 1 }}>
                    <h2 style={headingStyle}>{viewMode === 'countries' ? '📺 Live TV' : name}</h2>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                            {items.length} / {allItems.length} {viewMode === 'countries' ? 'countries' : 'channels'}
                        </div>
                        {viewMode === 'channels' && selectedCountry && (
                            <TimeDisplay timezone={selectedCountry.timezone} countryCode={selectedCountry.id} />
                        )}
                    </div>
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)} style={addMainBtnStyle}>
                    {showAddForm ? 'Close' : '+ Add Channel'}
                </button>
            </div>

            {/* Add Channel Form */}
            {showAddForm && (
                <form onSubmit={handleAddChannel} style={formStyle}>
                    <input 
                        type="text" placeholder="Channel Name (e.g. My Sports HD)" 
                        value={newChanName} onChange={e => setNewChanName(e.target.value)}
                        style={inputStyle} required
                    />
                    <input 
                        type="text" placeholder="IPTV .m3u8 URL or YouTube Live URL" 
                        value={newChanUrl} onChange={e => setNewChanUrl(e.target.value)}
                        style={inputStyle} required
                    />
                    <button type="submit" style={submitBtnStyle}>Save Channel</button>
                </form>
            )}

            {/* Search bar */}
            {!loading && allItems.length > 0 && (
                <div style={{ marginBottom: 24, position: 'relative', maxWidth: 480 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"
                        style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text" value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search channels or countries…"
                        style={searchStyle}
                    />
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div style={statusContainerStyle}>
                    <div style={spinnerStyle} />
                    <span>Loading...</span>
                </div>
            ) : error ? (
                <div style={statusContainerStyle}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
                    <p>{error}</p>
                    <button onClick={() => viewMode === 'countries' ? fetchCountries() : fetchChannels(selectedCountry?.id)} style={retryBtnStyle}>Retry</button>
                </div>
            ) : items.length === 0 ? (
                <div style={statusContainerStyle}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                    <p>{searchQuery ? `No results for "${searchQuery}"` : 'No channels found.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'countries' ? 'repeat(auto-fill,minmax(150px,1fr))' : 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
                    {items.map(item => viewMode === 'countries'
                        ? <CountryCard key={item.id} item={item} />
                        : <ChannelCard key={item.id} item={item} />
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
};
const hoverOn = e => {
    e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
    e.currentTarget.style.transform = 'translateY(-4px)';
};
const hoverOff = e => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    e.currentTarget.style.transform = 'translateY(0)';
};
const nameStyle = {
    fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const highlightStyle = { color: '#6366f1', fontWeight: 800 };
const backBtnStyle = {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'white', padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 500,
};
const headingStyle = {
    fontSize: '1.8rem', fontWeight: 700, margin: 0,
    background: 'linear-gradient(90deg,#fff,#a8b2d1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
};
const searchStyle = {
    width: '100%', padding: '12px 42px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: 'white',
    fontSize: '0.95rem', boxSizing: 'border-box',
};
const addMainBtnStyle = {
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
    color: '#a5b4fc', padding: '8px 20px', borderRadius: 12, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
};
const formStyle = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap'
};
const inputStyle = {
    flex: 1, minWidth: '200px', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', outline: 'none'
};
const submitBtnStyle = {
    background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px',
    borderRadius: 10, fontWeight: 600, cursor: 'pointer'
};
const deleteBtnStyle = {
    position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.2)',
    border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', width: 28, height: 28,
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s', zIndex: 10
};
const statusContainerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 16, color: 'rgba(255,255,255,0.4)' };
const spinnerStyle = { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' };
const retryBtnStyle = { marginTop: 12, padding: '8px 20px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', borderRadius: 8, cursor: 'pointer' };

export default TVDiscovery;
