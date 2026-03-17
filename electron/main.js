const { app, BrowserWindow, screen, session, utilityProcess } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;
let nodeBridgeProcess;

app.commandLine.appendSwitch('enable-features', 'CastMediaRouteProvider');
app.commandLine.appendSwitch('load-media-router-component-extension', '1');
app.commandLine.appendSwitch('enable-media-router');

function startNodeBridge() {
    if (nodeBridgeProcess && !nodeBridgeProcess.killed) {
        return;
    }

    const isPackaged = app.isPackaged;
    const logPath = path.join(require('os').homedir(), 'genga_electron_bridge.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    function bridgeLog(m) {
        const entry = `[${new Date().toISOString()}] ${m}\n`;
        console.log(entry.trim());
        logStream.write(entry);
    }

    bridgeLog(`--- Starting Node Bridge (Packaged: ${isPackaged}) ---`);

    // Path resolution
    let bridgePath;
    if (isPackaged) {
        bridgePath = path.join(process.resourcesPath, 'app.asar', 'node-bridge.js');
        if (!fs.existsSync(bridgePath)) {
            bridgePath = path.join(app.getAppPath(), 'node-bridge.js');
        }
    } else {
        bridgePath = path.join(__dirname, '..', 'node-bridge.js');
    }

    bridgeLog(`Selected Bridge Path: ${bridgePath}`);

    if (!fs.existsSync(bridgePath)) {
        bridgeLog(`CRITICAL ERROR: Node bridge script NOT FOUND at ${bridgePath}`);
        return;
    }

    try {
        if (!isPackaged) {
            bridgeLog(`Starting bridge via spawn for development: ${bridgePath}`);
            nodeBridgeProcess = spawn('node', [bridgePath], {
                cwd: path.dirname(bridgePath),
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'development' }
            });

            nodeBridgeProcess.stdout.on('data', (data) => bridgeLog(`[BRIDGE] ${data.toString()}`));
            nodeBridgeProcess.stderr.on('data', (data) => bridgeLog(`[BRIDGE ERROR] ${data.toString()}`));
            nodeBridgeProcess.on('exit', (code) => {
                bridgeLog(`Bridge spawned process exited with code ${code}.`);
                if (code !== 0 && code !== null) setTimeout(startNodeBridge, 5000);
            });
            return;
        }

        bridgeLog(`Forking utilityProcess: ${bridgePath}`);
        nodeBridgeProcess = utilityProcess.fork(bridgePath, [], {
            cwd: process.resourcesPath,
            stdio: 'pipe',
            env: { 
                ...process.env,
                NODE_ENV: 'production'
            }
        });

        nodeBridgeProcess.on('spawn', () => {
            bridgeLog(`SUCCESS: Bridge utilityProcess spawned.`);
        });

        nodeBridgeProcess.stdout.on('data', (data) => {
            bridgeLog(`[BRIDGE] ${data.toString()}`);
        });

        nodeBridgeProcess.stderr.on('data', (data) => {
            bridgeLog(`[BRIDGE ERROR] ${data.toString()}`);
        });

        nodeBridgeProcess.on('message', (msg) => {
            bridgeLog(`[BRIDGE MSG] ${JSON.stringify(msg)}`);
        });

        nodeBridgeProcess.on('exit', (code) => {
            bridgeLog(`Bridge exited with code ${code}.`);
            if (code !== 0 && code !== null) {
                bridgeLog('Restarting in 5s...');
                setTimeout(startNodeBridge, 5000);
            }
        });

        nodeBridgeProcess.on('error', (err) => {
            bridgeLog(`CRITICAL Bridge error: ${err.message}`);
        });

    } catch (err) {
        bridgeLog(`CRITICAL: Failed to start bridge: ${err.message}`);
    }
}

let backendRestartCount = 0;
const MAX_BACKEND_RESTARTS = 5;

function startBackend() {
    const isPackaged = app.isPackaged;
    const backendDir = isPackaged
        ? path.join(process.resourcesPath, 'backend')
        : path.join(__dirname, '..');
    const executablePath = isPackaged
        ? path.join(backendDir, 'backend.exe')
        : 'python';
    const finalArgs = isPackaged
        ? []
        : ['-m', 'uvicorn', 'backend.main:app', '--host', '0.0.0.0', '--port', '8000'];

    if (isPackaged && !fs.existsSync(executablePath)) {
        console.error(`[BACKEND] CRITICAL: backend.exe NOT FOUND at ${executablePath}`);
        // List what IS there
        try {
            const files = fs.readdirSync(backendDir);
            console.error(`[BACKEND] Contents of ${backendDir}:`, files);
        } catch (e) {
            console.error(`[BACKEND] Cannot read dir ${backendDir}:`, e.message);
        }
        return;
    }

    console.log(`[BACKEND] Starting (restart #${backendRestartCount})...`);
    console.log(`[BACKEND] Executable: ${executablePath}`);
    console.log(`[BACKEND] CWD: ${backendDir}`);

    const logPath = path.join(require('os').homedir(), 'genga_electron_backend.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const timestamp = new Date().toISOString();
    logStream.write(`\n--- Backend Start [${timestamp}] (restart #${backendRestartCount}) ---\n`);

    backendProcess = spawn(executablePath, finalArgs, {
        cwd: backendDir,
        shell: false,
        windowsHide: true,
        env: {
            ...process.env,
            PYTHONNOUSERSITE: '1',
            PYTHONUNBUFFERED: '1'  // Ensure real-time stdout
        }
    });

    backendProcess.stdout.on('data', (data) => {
        const msg = `[BACKEND] ${data}`;
        console.log(msg);
        logStream.write(msg);
    });

    backendProcess.stderr.on('data', (data) => {
        const msg = `[BACKEND ERR] ${data}`;
        console.error(msg);
        logStream.write(msg);
    });

    backendProcess.on('close', (code, signal) => {
        const msg = `[BACKEND] Process exited — code: ${code}, signal: ${signal}`;
        console.log(msg);
        logStream.write(msg + '\n');

        if (code !== 0 && code !== null && !app.isQuitting) {
            // Auto-restart on crash
            if (backendRestartCount < MAX_BACKEND_RESTARTS) {
                backendRestartCount++;
                const delay = Math.min(3000 * backendRestartCount, 10000); // 3s, 6s, 9s...
                console.log(`[BACKEND] Restarting in ${delay}ms... (attempt ${backendRestartCount}/${MAX_BACKEND_RESTARTS})`);
                logStream.write(`[BACKEND] Restarting in ${delay}ms...\n`);
                setTimeout(() => startBackend(), delay);
            } else {
                console.error('[BACKEND] Max restarts reached. Backend is not starting correctly.');
                logStream.write('[BACKEND] Max restarts reached.\n');
            }
        }
    });

    backendProcess.on('error', (err) => {
        console.error(`[BACKEND] Spawn error: ${err.message}`);
        logStream.write(`[BACKEND] Spawn error: ${err.message}\n`);
    });
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1400, width),
        height: Math.min(900, height),
        show: false,
        frame: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        },
        title: "Genga Movie",
        backgroundColor: '#0a0a12',
        autoHideMenuBar: true,
        icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.png')
    });

    const prodUrl = 'http://localhost:8000';
    const splashPath = path.join(__dirname, 'splash.html');

    // Step 1: Load the splash screen immediately and show the window
    mainWindow.loadFile(splashPath).then(() => {
        mainWindow.show();
        console.log('[UI] Splash screen shown');
    }).catch(err => {
        console.error('[UI] Failed to load splash:', err);
        mainWindow.show(); // Show anyway
    });

    if (app.isPackaged) {
        // Step 2: Poll for backend readiness using Node's built-in http module
        const http = require('http');

        const checkBackend = (attempts = 0) => {
            const req = http.get(`${prodUrl}/api/health`, { timeout: 1000 }, (res) => {
                if (res.statusCode === 200) {
                    console.log(`[UI] Backend ready! (attempt ${attempts}). Loading app...`);
                    // Step 3: Transition to real app
                    mainWindow.loadURL(prodUrl).catch(e => {
                        console.error('[UI] Failed to load app URL:', e);
                    });
                } else {
                    req.destroy();
                    if (attempts < 60) setTimeout(() => checkBackend(attempts + 1), 500);
                }
            });
            req.on('error', () => {
                // Backend not yet up, keep trying
                if (attempts < 60) setTimeout(() => checkBackend(attempts + 1), 500);
                else {
                    // Final fallback: load local index.html
                    const localFile = path.join(process.resourcesPath, 'dist-frontend', 'index.html');
                    console.warn(`[UI] Backend timed out. Loading fallback: ${localFile}`);
                    mainWindow.loadFile(localFile).catch(e => console.error('[UI] Fallback failed:', e));
                }
            });
            req.on('timeout', () => req.destroy());
        };

        // Start checking after a very short delay to allow backend process to spawn
        setTimeout(() => checkBackend(0), 800);
    } else {
        // Development mode: load Vite dev server
        const devUrl = 'http://localhost:5173';
        const tryLoadDev = (attempts = 0) => {
            mainWindow.loadURL(devUrl).catch(() => {
                if (attempts < 10) setTimeout(() => tryLoadDev(attempts + 1), 1000);
            });
        };
        setTimeout(() => tryLoadDev(), 1000);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // FIX for YouTube Errors (150, 152, 153): Standard Mirror Interceptor (v1.1.0)
    // Set a global high-quality User-Agent for the entire session
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    session.defaultSession.setUserAgent(userAgent);

    const filter = {
        urls: [
            '*://*.youtube.com/*',
            '*://*.youtube-nocookie.com/*',
            '*://*.googlevideo.com/*',
            '*://*.ytimg.com/*',
            '*://*.google.com/*',
            '*://*.gstatic.com/*',
            '*://*.doubleclick.net/*',
            '*://*.googleusercontent.com/*',
            '*://*.ggpht.com/*'
        ]
    };

    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        const url = details.url.toLowerCase();
        const isYT = url.includes('youtube') || url.includes('googlevideo') || url.includes('ytimg');

        if (isYT) {
            // WHITESPACE AND REFERER REFINEMENT
            // Using a high-trust Referer/Origin pair for broad embed support
            details.requestHeaders['Referer'] = 'https://fmoviesunblocked.net/';
            details.requestHeaders['Origin'] = 'https://h5.aoneroom.com';

            if (details.resourceType === 'subFrame') {
                details.requestHeaders['Sec-Fetch-Site'] = 'cross-site';
                details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
                details.requestHeaders['Sec-Fetch-Dest'] = 'iframe';
                details.requestHeaders['Sec-Fetch-User'] = '?1';
            }
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
        const responseHeaders = { ...details.responseHeaders };

        // Strip all embedding and security restrictions
        const headersToStrip = [
            'x-frame-options',
            'content-security-policy',
            'frame-options',
            'x-content-security-policy',
            'cross-origin-embedder-policy',
            'cross-origin-opener-policy',
            'cross-origin-resource-policy'
        ];

        Object.keys(responseHeaders).forEach(header => {
            if (headersToStrip.includes(header.toLowerCase())) {
                delete responseHeaders[header];
            }
        });

        // Add Allow-Origin/CORS for wide compatibility (Crucial for YouTube scripts)
        // Clear existing ones to avoid "multiple values" errors
        delete responseHeaders['access-control-allow-origin'];
        delete responseHeaders['Access-Control-Allow-Origin'];
        delete responseHeaders['access-control-allow-methods'];
        delete responseHeaders['Access-Control-Allow-Methods'];
        
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];

        callback({ cancel: false, responseHeaders });
    });

    startBackend();
    startNodeBridge();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (backendProcess) {
        console.log('Stopping Python backend...');
        if (process.platform === 'win32') {
            // Use absolute path for taskkill to avoid ENOENT
            const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
            try {
                spawn(taskkill, ['/pid', backendProcess.pid, '/f', '/t'], { shell: false });
            } catch (e) {
                backendProcess.kill();
            }
        } else {
            backendProcess.kill();
        }
    }
    if (nodeBridgeProcess) {
        console.log('Stopping Node Bridge...');
        nodeBridgeProcess.kill();
    }
});
