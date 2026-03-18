import React, { useMemo } from 'react';
import './Sidebar.css';

const Icon = ({ children }) => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {children}
    </svg>
);

const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path> },
    { id: 'moviebox', label: 'MovieBox', icon: <path d="M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 16l5-3 5 3V8l-5 3-5-3v8z"></path> },
    { id: 'animepahe', label: 'Anime', icon: <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"></path> },
    { id: 'manga', label: 'Manga', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></> },
    { id: 'novel', label: 'Novel', icon: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></> },
    { id: 'tv', label: 'Live TV', icon: <><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></> },
    { id: 'news', label: 'News', icon: <><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8z"></path></> },
    { id: 'music', label: 'Music', icon: <><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></> },
    { id: 'history', label: 'History', icon: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></> }
];

const Sidebar = ({ activeSource, onChangeSource, serverStatus, isOpen, onToggle }) => {
    return (
        <aside 
            className="sidebar-container" 
            style={{ width: isOpen ? '240px' : '70px' }}
            aria-label="Main Sidebar"
        >
            {/* Logo Area */}
            <div 
                className="logo-area"
                style={{ 
                    padding: isOpen ? '0 1rem' : '0',
                    justifyContent: isOpen ? 'space-between' : 'center'
                }}
            >
                {isOpen && (
                    <div className="logo-text">
                        <h1>GENGA</h1>
                        <p>Movies</p>
                    </div>
                )}

                <button
                    className="toggle-btn"
                    onClick={onToggle}
                    aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                    <Icon>
                        {isOpen ? (
                            <polyline points="15 18 9 12 15 6"></polyline>
                        ) : (
                            <polyline points="9 18 15 12 9 6"></polyline>
                        )}
                    </Icon>
                </button>
            </div>

            {/* Navigation */}
            <nav className="nav-list">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item-btn ${activeSource === item.id ? 'active' : ''}`}
                        onClick={() => onChangeSource(item.id)}
                        title={!isOpen ? item.label : ''}
                        aria-current={activeSource === item.id ? 'page' : undefined}
                        aria-label={item.label}
                        style={{ justifyContent: isOpen ? 'flex-start' : 'center' }}
                    >
                        <Icon>{item.icon}</Icon>
                        {isOpen && item.label}
                    </button>
                ))}
            </nav>

            {/* Status Footer */}
            <div 
                className="status-footer"
                style={{ 
                    padding: isOpen ? '1rem' : '1rem 0',
                    alignItems: isOpen ? 'flex-start' : 'center'
                }}
            >
                <div 
                    className="status-indicator"
                    style={{ justifyContent: isOpen ? 'flex-start' : 'center' }}
                >
                    <div className={`status-dot ${serverStatus === 'operational' ? 'operational' : 'issue'}`}></div>
                    {isOpen && (
                        <span>
                            {serverStatus === 'operational' ? 'Systems Normal' : 'Service Issue'}
                        </span>
                    )}
                </div>
                {isOpen && (
                    <div className="update-time">
                        Updated 5m ago
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
