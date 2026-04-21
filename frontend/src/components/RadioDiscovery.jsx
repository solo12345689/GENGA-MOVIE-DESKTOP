import React, { useState, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const nameStyle = {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.3,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 16px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
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

const headingStyle = {
    fontSize: '1.8rem',
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(90deg,#fff,#a8b2d1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
};

const searchStyle = {
    width: '100%',
    padding: '12px 42px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: 'white',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
};

const backBtnStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.9rem',
    fontWeight: 500,
    flexShrink: 0,
};

const clearBtnStyle = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const highlightMatch = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <span key={i} style={{ color: '#6366f1', fontWeight: 800 }}>{part}</span>
            : part
    );
};

// ─── Component ────────────────────────────────────────────────────────────────
const RadioDiscovery = ({ onStream, API_BASE = '' }) => {
    const [viewMode, setViewMode] = useState('countries');
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (viewMode === 'countries') {
            fetchCountries();
        }
    }, [viewMode]);

    const fetchCountries = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/radio/countries`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAllItems(data.results || []);
        } catch (e) {
            setError(`Could not load countries: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchChannels = async (code) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/radio/country/${code}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAllItems(data.results || []);
        } catch (e) {
            setError(`Could not load stations: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCountryClick = (country) => {
        setSelectedCountry(country);
        setViewMode('channels');
        setSearchQuery('');
        fetchChannels(country.id);
    };

    const items = allItems.filter(item =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const CountryCard = ({ item }) => {
        const flagUrl = item.id.length === 2 ? `https://flagcdn.com/w160/${item.id.toLowerCase()}.png` : null;
        const flag = item.id.length === 2 ? null : '🌍';

        return (
            <div style={cardStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={() => handleCountryClick(item)}>
                <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {flagUrl ? (
                        <img 
                            src={flagUrl} 
                            alt="" 
                            style={{ width: 80, height: 'auto', borderRadius: 4, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
                        />
                    ) : (
                        <span style={{ fontSize: '3rem' }}>{flag}</span>
                    )}
                </div>
                <span style={nameStyle}>{highlightMatch(item.name, searchQuery)}</span>
            </div>
        );
    };

    // --- Time Display Component ---
    const TimeDisplay = ({ countryCode }) => {
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

        const tz = tzMap[countryCode?.toLowerCase()];
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

    const ChannelCard = ({ item }) => {
        const [imgError, setImgError] = useState(false);
        return (
            <div style={cardStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={() => onStream(item)}>
                <div style={{ marginBottom: 16 }}>
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
                    background: 'rgba(139,92,246,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.3)',
                    fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>📻 Radio</span>
            </div>
        );
    };

    return (
        <div style={{ padding: '20px 40px', minHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                {viewMode === 'channels' && (
                    <button onClick={() => { setViewMode('countries'); setSelectedCountry(null); }} style={backBtnStyle}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        Back
                    </button>
                )}
                <div style={{ flex: 1 }}>
                    <h2 style={headingStyle}>{viewMode === 'countries' ? '📻 Live Radio' : (selectedCountry?.name || selectedCountry?.title)}</h2>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                            {items.length} / {allItems.length} {viewMode === 'countries' ? 'countries' : 'stations'}
                        </div>
                        {viewMode === 'channels' && selectedCountry && (
                            <TimeDisplay countryCode={selectedCountry.id} />
                        )}
                    </div>
                </div>
            </div>

            {!loading && allItems.length > 0 && (
                <div style={{ marginBottom: 24, position: 'relative', maxWidth: 480 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"
                        style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text" value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={viewMode === 'countries' ? 'Search countries…' : 'Search stations…'}
                        style={searchStyle}
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')} style={clearBtnStyle}>×</button>}
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 16, color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Loading radio {viewMode}…</span>
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', color: '#ef4444', padding: 80 }}>
                    <p>{error}</p>
                    <button onClick={() => viewMode === 'countries' ? fetchCountries() : fetchChannels(selectedCountry?.id)}
                        style={{ marginTop: 12, padding: '8px 20px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, cursor: 'pointer', color: '#fff' }}>
                        Retry
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
                    {items.map(item => viewMode === 'countries'
                        ? <CountryCard key={item.id} item={item} />
                        : <ChannelCard key={item.id} item={item} />
                    )}
                </div>
            )}
        </div>
    );
};

export default RadioDiscovery;
