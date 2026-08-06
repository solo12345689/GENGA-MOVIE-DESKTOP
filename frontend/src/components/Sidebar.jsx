import React from 'react';

const Sidebar = ({ activeSource, onChangeSource, serverStatus, isOpen, onToggle }) => {
    const navItems = [
        { id: 'home', label: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path> },
        { id: 'anilist', label: 'Anime', icon: <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"></path> },
        { id: 'manga', label: 'Manga', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></> },
        { id: 'tv', label: 'Live TV', icon: <><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></> },
        { id: 'news', label: 'News', icon: <><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8z"></path></> },
        { id: 'music', label: 'Music', icon: <><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></> },
        { id: 'radio', label: 'Radio', icon: <><rect x="2" y="8" width="20" height="14" rx="2" ry="2"></rect><path d="M12 2v6"></path><circle cx="8" cy="15" r="3"></circle><line x1="16" y1="12" x2="18" y2="12"></line><line x1="16" y1="15" x2="18" y2="15"></line><line x1="16" y1="18" x2="18" y2="18"></line></> },
        { id: 'history', label: 'History', icon: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></> }
    ];

    return (
        <aside 
            className="glass-panel"
            style={{
                width: isOpen ? '260px' : '85px',
                height: 'calc(100vh - 2rem)',
                margin: '1rem',
                borderRadius: 'var(--radius-lg)',
                position: 'sticky',
                top: '1rem',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem 1rem',
                zIndex: 100,
                flexShrink: 0,
                transition: 'all 0.5s var(--ease-out)',
                border: '1px solid var(--border-bright)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
        >
            {/* Logo Area */}
            <div style={{
                padding: isOpen ? '0 1rem' : '0',
                marginBottom: '4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isOpen ? 'space-between' : 'center',
                animation: 'fadeIn 0.8s ease-out'
            }}>
                {isOpen && (
                    <div className="animate-float">
                        <h1 style={{
                            fontSize: '1.8rem',
                            margin: 0,
                            background: 'linear-gradient(135deg, #fff 0%, var(--primary) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: '900',
                            letterSpacing: '-1.5px'
                        }}>
                            GENGA
                        </h1>
                        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', marginTop: '2px', letterSpacing: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>MOVIES</p>
                    </div>
                )}

                <button
                    onClick={onToggle}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    {isOpen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {navItems.map(item => {
                    const isActive = activeSource === item.id || (item.id === 'home' && activeSource === 'moviebox');
                    return (
                        <button
                            key={item.id}
                            onClick={() => onChangeSource(item.id)}
                            title={!isOpen ? item.label : ''}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isOpen ? 'flex-start' : 'center',
                                gap: '16px',
                                padding: '14px 18px',
                                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                border: '1px solid',
                                borderColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                borderRadius: '16px',
                                color: isActive ? '#fff' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.3s var(--ease-out)',
                                textAlign: 'left',
                                fontSize: '0.95rem',
                                fontWeight: isActive ? '600' : '500',
                                width: '100%',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-muted)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                }
                            }}
                        >
                            {/* THE ACTIVE INDICATOR GLOW */}
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '20%',
                                    bottom: '20%',
                                    width: '4px',
                                    background: 'var(--primary)',
                                    borderRadius: '0 4px 4px 0',
                                    boxShadow: '0 0 15px var(--primary)'
                                }} />
                            )}

                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={isActive ? 'var(--primary)' : 'currentColor'}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ 
                                    transition: 'all 0.3s',
                                    filter: isActive ? 'drop-shadow(0 0 5px var(--primary-glow))' : 'none'
                                }}
                            >
                                {item.icon}
                            </svg>
                            {isOpen && <span style={{ transition: 'opacity 0.3s', opacity: 1 }}>{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            {/* Status Footer */}
            <div style={{ marginTop: 'auto', padding: isOpen ? '1.5rem' : '1.5rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'flex-start' : 'center' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    fontSize: '0.8rem', 
                    color: 'var(--text-muted)', 
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    background: 'rgba(0,0,0,0.2)',
                    padding: isOpen ? '8px 12px' : '8px',
                    borderRadius: '12px'
                }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: serverStatus === 'operational' ? '#22c55e' : '#ef4444',
                        boxShadow: serverStatus === 'operational' ? '0 0 12px #22c55e' : 'none',
                        transition: 'background 0.3s'
                    }}></div>
                    {isOpen && (
                        <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>
                            {serverStatus === 'operational' ? 'SYSTEM ONLINE' : 'OFFLINE'}
                        </span>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
