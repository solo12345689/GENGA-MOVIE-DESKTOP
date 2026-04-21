import React, { useRef, useEffect, useState } from 'react';

const RadioPlayer = ({ station, onClose }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [volume, setVolume] = useState(1);
    const [error, setError] = useState(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !station.url) return;

        let hls = null;
        const setupSource = () => {
            const url = station.url;
            if (url.includes('.m3u8')) {
                // Check if HLS is already loaded (via MusicPlayer or Global script)
                const playHls = () => {
                    if (window.Hls && window.Hls.isSupported()) {
                        hls = new window.Hls();
                        hls.loadSource(url);
                        hls.attachMedia(audio);
                        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                            audio.play().catch(e => console.warn("Radio autoplay blocked:", e));
                        });
                        hls.on(window.Hls.Events.ERROR, (event, data) => {
                            if (data.fatal) setError("Failed to load stream");
                        });
                    } else {
                        audio.src = url;
                        audio.play().catch(() => {});
                    }
                };

                if (window.Hls) {
                    playHls();
                } else {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                    script.onload = playHls;
                    document.head.appendChild(script);
                }
            } else {
                audio.src = url;
                audio.play().catch(e => console.warn("Radio audio play error:", e));
            }
        };

        setupSource();

        return () => {
            if (hls) hls.destroy();
            audio.pause();
            audio.src = '';
        };
    }, [station.url]);

    const togglePlay = () => {
        if (audioRef.current.paused) {
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(15, 15, 15, 0.9)',
                backdropFilter: 'blur(30px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 1000,
                color: '#fff',
                height: '80px',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.6)'
            }}
        >
            <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

            {/* Station info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '35%' }}>
                <div style={{ position: 'relative' }}>
                    {station.poster_url ? (
                        <img src={station.poster_url} alt={station.title} style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {station.title?.charAt(0)}
                        </div>
                    )}
                    <div style={{ position: 'absolute', top: -4, right: -4, width: '12px', height: '12px', background: isPlaying ? '#22c55e' : '#666', borderRadius: '50%', border: '2px solid #000', animation: isPlaying ? 'pulse 2s infinite' : 'none' }} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{station.title}</h4>
                    <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {isPlaying ? '• Broadcasting' : 'Paused'}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button
                    onClick={togglePlay}
                    style={{
                        background: '#fff',
                        color: '#000',
                        border: 'none',
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
                    }}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>
            </div>

            {/* Volume & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', width: '35%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ opacity: 0.5, fontSize: '1.2rem' }}>🔊</span>
                    <input
                        type="range" min="0" max="1" step="0.01" value={volume}
                        onChange={e => {
                            setVolume(e.target.value);
                            audioRef.current.volume = e.target.value;
                        }}
                        style={{ width: '100px', accentColor: '#fff', height: '4px' }}
                    />
                </div>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.5 }}>✕</button>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 139, 94, 0.7); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                }
            `}</style>
        </div>
    );
};

export default RadioPlayer;
