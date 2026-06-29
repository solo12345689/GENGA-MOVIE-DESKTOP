import React, { useState } from 'react';

const SearchBar = ({ onSearch, placeholder = "Search..." }) => {
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const wrapperRef = React.useRef(null);

    // Load history from localStorage on mount
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem('moviebox_web_history');
            if (saved) {
                setHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }

        // Click outside listener
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowHistory(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const saveHistory = (newHistory) => {
        setHistory(newHistory);
        localStorage.setItem('moviebox_web_history', JSON.stringify(newHistory));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            const trimmed = query.trim();
            onSearch(trimmed, 'all');
            setShowHistory(false);

            // Add to history (remove duplicates, keep top 5)
            const newHistory = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 5);
            saveHistory(newHistory);
        }
    };

    const handleHistoryClick = (item) => {
        setQuery(item);
        onSearch(item, 'all');
        setShowHistory(false);
        // Move to top
        const newHistory = [item, ...history.filter(h => h !== item)];
        saveHistory(newHistory);
    };

    const deleteHistoryItem = (e, item) => {
        e.stopPropagation();
        const newHistory = history.filter(h => h !== item);
        saveHistory(newHistory);
    };

    const [isFocused, setIsFocused] = useState(false);

    return (
        <div ref={wrapperRef} className="search-container" style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 110 }}>
                <div style={{
                    position: 'relative',
                    transition: 'all 0.4s var(--ease-out)',
                    transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                }}>
                    <input
                        type="text"
                        className="input-glass"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => {
                            setShowHistory(true);
                            setIsFocused(true);
                        }}
                        onBlur={() => setIsFocused(false)}
                        style={{ 
                            paddingLeft: '3.5rem', 
                            paddingRight: '1.5rem',
                            background: isFocused ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
                            boxShadow: isFocused ? '0 0 20px rgba(255,255,255,0.08)' : 'none',
                        }}
                    />
                    
                    {/* Search Icon */}
                    <div style={{
                        position: 'absolute',
                        left: '1.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: isFocused ? '#ffffff' : 'var(--text-muted)',
                        transition: 'color 0.3s',
                        pointerEvents: 'none'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                </div>
            </form>

            {/* History Dropdown */}
            {showHistory && history.length > 0 && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: 'calc(100% + 15px)',
                    left: 0,
                    right: 0,
                    borderRadius: '24px',
                    padding: '12px',
                    zIndex: 100,
                    animation: 'fadeIn 0.4s var(--ease-out)',
                    border: '1px solid var(--border-bright)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                }}>
                    <div style={{ 
                        padding: '10px 15px', 
                        fontSize: '0.75rem', 
                        color: 'var(--text-dim)', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        fontWeight: '800',
                        letterSpacing: '1px'
                    }}>
                        <span>RECENT SEARCHES</span>
                        <span 
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', '&:hover': { color: '#ffffff', textDecoration: 'underline' } }} 
                            onClick={() => saveHistory([])}
                        >
                            CLEAR ALL
                        </span>
                    </div>
                    {history.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleHistoryClick(item)}
                            className="history-item-container"
                            style={{
                                padding: '12px 18px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderRadius: '16px',
                                color: 'var(--text-main)',
                                transition: 'all 0.2s',
                                marginTop: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ opacity: 0.6 }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span style={{ fontWeight: '500' }}>{item}</span>
                            </div>
                            <button
                                onClick={(e) => deleteHistoryItem(e, item)}
                                className="remove-history-btn"
                                style={{ 
                                    background: 'rgba(255,255,255,0.1)', 
                                    border: 'none', 
                                    color: 'var(--text-muted)', 
                                    cursor: 'pointer', 
                                    opacity: 0, 
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
