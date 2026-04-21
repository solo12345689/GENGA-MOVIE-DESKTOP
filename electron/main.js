const { app, BrowserWindow, screen, session, utilityProcess, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// [SINGLETON GUARD] Official Genga Movie Team Safety Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    let mainWindow;
    let backendProcess;
    let nodeBridgeProcess;

    async function isPortOpen(port) {
        const axios = require('axios');
        try {
            await axios.get(`http://127.0.0.1:${port}/`, { timeout: 800 });
            return true;
        } catch (e) {
            return false;
        }
    }

    function startNodeBridge() {
        if (nodeBridgeProcess && !nodeBridgeProcess.killed) return;
        const isPackaged = app.isPackaged;
        const logPath = path.join(require('os').homedir(), 'genga_electron_bridge.log');
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });
        const log = (msg) => { logStream.write(`[${new Date().toISOString()}] ${msg}\n`); console.log(msg); };

        let bridgePath;
        if (isPackaged) {
            bridgePath = path.join(process.resourcesPath, 'app.asar', 'node-bridge.js');
            if (!fs.existsSync(bridgePath)) bridgePath = path.join(app.getAppPath(), 'node-bridge.js');
        } else {
            bridgePath = path.join(__dirname, '..', 'node-bridge.js');
        }

        if (!fs.existsSync(bridgePath)) return log("ERROR: Bridge file not found");

        try {
            if (!isPackaged) {
                nodeBridgeProcess = spawn('node', [bridgePath], { cwd: path.dirname(bridgePath), stdio: 'pipe' });
                return;
            }
            nodeBridgeProcess = utilityProcess.fork(bridgePath, [], {
                cwd: process.resourcesPath,
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'production' }
            });
        } catch (err) { log(`CRITICAL: ${err.message}`); }
    }

    function startBackend() {
        if (backendProcess && !backendProcess.killed) return;
        const isPackaged = app.isPackaged;
        const backendDir = isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(__dirname, '..', 'dist-backend');
        const executablePath = isPackaged ? path.join(backendDir, 'backend.exe') : 'python';
        const finalArgs = isPackaged ? [] : ['run_backend.py'];

        const logPath = path.join(require('os').homedir(), 'genga_electron_backend.log');
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });
        const log = (msg) => { logStream.write(`[${new Date().toISOString()}] ${msg}\n`); console.log(msg); };

        if (isPackaged && !fs.existsSync(executablePath)) return log("ERROR: backend.exe not found");

        backendProcess = spawn(executablePath, finalArgs, {
            cwd: backendDir,
            shell: false, 
            windowsHide: true,
            env: { ...process.env, PYTHONNOUSERSITE: '1' }
        });
    }

    function createWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow = new BrowserWindow({
            width: Math.min(1300, width),
            height: Math.min(900, height),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                allowRunningInsecureContent: true
            },
            title: "Genga Movie",
            backgroundColor: '#000000',
            autoHideMenuBar: true,
            icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico')
        });

        if (app.isPackaged) {
            mainWindow.loadFile(path.join(__dirname, '..', 'dist-frontend', 'index.html'));
        } else {
            mainWindow.loadURL('http://localhost:5173');
        }
    }

    app.whenReady().then(async () => {
        // [SPEED OPTIMIZATION] Open UI instantly so user sees the app right away
        createWindow();

        // Start backend gracefully in background
        const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
        try { spawn(taskkill, ['/F', '/IM', 'backend.exe', '/T'], { shell: false }); } catch (e) {}
        
        setTimeout(async () => {
            const alreadyRunning = await isPortOpen(8000);
            if (!alreadyRunning) {
                startBackend();
            }
        }, 500); // Only small wait to let taskkill finish
        
        startNodeBridge();

        // Native download handler via IPC (renderer calls this directly)
        ipcMain.on('start-download', (event, url) => {
            if (mainWindow) {
                mainWindow.webContents.downloadURL(url);
            }
        });

        // INSTANT save dialog: fires the moment Electron intercepts any download,
        // before any HTTP body is received — guarantees dialog appears immediately.
        session.defaultSession.on('will-download', (event, item) => {
            const filename = item.getFilename();
            const downloadsDir = path.join(require('os').homedir(), 'Downloads');
            const savePath = dialog.showSaveDialogSync(mainWindow, {
                title: 'Save File',
                defaultPath: path.join(downloadsDir, filename),
            });
            if (savePath) {
                item.setSavePath(savePath);
            } else {
                item.cancel();
            }
        });

        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
        session.defaultSession.setUserAgent(userAgent);

        // Only intercept YouTube requests — don't touch megaplay or other embeds
        const ytFilter = { urls: [
            '*://*.youtube.com/*',
            '*://*.youtube-nocookie.com/*',
            '*://*.googlevideo.com/*',
            '*://*.ytimg.com/*'
        ]};

        session.defaultSession.webRequest.onBeforeSendHeaders(ytFilter, (details, callback) => {
            details.requestHeaders['User-Agent'] = userAgent;
            details.requestHeaders['Referer'] = 'https://fmoviesunblocked.net/';
            details.requestHeaders['Origin'] = 'https://h5.aoneroom.com';
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        });

        // Strip security headers from ALL responses so iframes (megaplay, etc.) can embed freely
        const allFilter = { urls: ['*://*/*'] };
        session.defaultSession.webRequest.onHeadersReceived(allFilter, (details, callback) => {
            const responseHeaders = { ...details.responseHeaders };
            const strip = ['x-frame-options', 'content-security-policy', 'frame-options', 'x-content-security-policy', 'cross-origin-embedder-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy'];
            Object.keys(responseHeaders).forEach(h => { if (strip.includes(h.toLowerCase())) delete responseHeaders[h]; });
            delete responseHeaders['access-control-allow-origin'];
            delete responseHeaders['Access-Control-Allow-Origin'];
            responseHeaders['Access-Control-Allow-Origin'] = ['*'];
            responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
            responseHeaders['Access-Control-Allow-Headers'] = ['*'];
            callback({ cancel: false, responseHeaders });
        });
    });

    app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

    app.on('before-quit', () => {
        // [ULTIMATE CLEANUP] Genga Team Tree-Kill Method
        const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
        if (backendProcess) {
            try { spawn(taskkill, ['/pid', backendProcess.pid, '/f', '/t'], { shell: false }); } catch (e) { backendProcess.kill(); }
        }
        // Sweep all remaining backend fragments
        try { spawn(taskkill, ['/F', '/IM', 'backend.exe', '/T'], { shell: false }); } catch (e) {}
        if (nodeBridgeProcess) nodeBridgeProcess.kill();
    });
}
