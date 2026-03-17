import sys
import os
import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- FIX: PATCH GAANAPY FOR STANDALONE RUNTIME ---
# GaanaPy 0.1.0 creates aiohttp.ClientSession() at import time.
# This causes RuntimeError: no running event loop in some environments.
try:
    import aiohttp
    import gaanapy.gaanapy
    import gaanapy
    
    class LazyGaanaPy(gaanapy.gaanapy.GaanaPy):
        def __init__(self):
            # Manually initialize components instead of calling super().__init__
            # which would trigger the ClientSession creation.
            self.api_endpoints = gaanapy.gaanapy.endpoints
            from gaanapy.functions import Functions
            from gaanapy.errors import Errors
            self.functions = Functions()
            self.errors = Errors()
            self.info = False
            self._session = None

        @property
        def aiohttp(self):
            # Check if session exists or is closed
            if self._session is None or self._session.closed:
                try:
                    # Try to get the current loop, but don't fail if not running
                    # aiohttp will find it when it needs it.
                    self._session = aiohttp.ClientSession()
                except Exception:
                    # Fallback
                    self._session = aiohttp.ClientSession()
            return self._session
            
        @aiohttp.setter
        def aiohttp(self, value):
            self._session = value

    # Apply the patch to both the module and the class
    gaanapy.gaanapy.GaanaPy = LazyGaanaPy
    gaanapy.GaanaPy = LazyGaanaPy
    print("Successfully patched GaanaPy for lazy session initialization")
except Exception as e:
    print(f"Warning: Could not patch GaanaPy: {e}")

# --- PATH SETUP ---
if getattr(sys, 'frozen', False):
    # PyInstaller one-file build: all .py modules are compiled INTO the EXE.
    # sys._MEIPASS is a temp directory with extracted binary dependencies (.pyd, .dll).
    # We do NOT need to add a 'backend' subfolder; 'api' is importable directly.
    base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    
    # Add _MEIPASS itself to path (for compiled binary extensions)
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    
    # Log startup info for debugging
    try:
        log_path = os.path.join(os.path.expanduser("~"), "genga_backend_debug.log")
        with open(log_path, "w") as f:
            f.write(f"Frozen: True\nMEIPASS: {base_dir}\n")
            f.write(f"sys.path: {sys.path}\n")
            f.write(f"Executable: {sys.executable}\n")
    except:
        pass
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)

# --- IMPORT API ROUTER ---
# In a PyInstaller one-file build, all Python modules are compiled directly
# into the EXE and are importable via normal `import` statements.
# DO NOT try to import from .py files on disk — they don't exist in frozen mode.

try:
    import api
    api_router = api.router
    print(f"[BOOT] Successfully imported api.router")
except Exception as e:
    import traceback
    print(f"[BOOT] CRITICAL: Failed to import api module: {e}")
    traceback.print_exc()
    # Write full traceback to debug log
    try:
        log_path = os.path.join(os.path.expanduser("~"), "genga_backend_debug.log")
        with open(log_path, "a") as f:
            f.write(f"\nFATAL IMPORT ERROR:\n")
            traceback.print_exc(file=f)
    except:
        pass
    sys.exit(1)

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI(title="Genga Movie", description="API for Genga Movie Desktop App")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

# --- STATIC FILE SERVING (Serve Frontend) ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

# Determine frontend path
if getattr(sys, 'frozen', False):
    # Packaged: dist-frontend is sibling to backend/ executable in resources
    # app/resources/backend/backend.exe
    # app/resources/dist-frontend/index.html
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(sys.executable)), 'dist-frontend'))
else:
    # Development: d:\GENGA-MOVIE-DESKTOP\dist-frontend
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist-frontend'))

print(f"Backend serving frontend from: {frontend_dir}")

if os.path.exists(frontend_dir):
    # 1. Mount the assets folder explicitly for performance
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # 2. Catch-all route for SPA (Single Page Application)
    # This ensures that if the user refreshes on /watch/123, the backend still serves index.html
    @app.get("/{rest_of_path:path}")
    async def catch_all(rest_of_path: str):
        # If it's a direct file (like favicon.ico or logo.png), serve it
        full_path = os.path.join(frontend_dir, rest_of_path)
        if rest_of_path and os.path.isfile(full_path):
            return FileResponse(full_path)
            
        # Otherwise, always serve index.html for React Router to handle
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend build files missing", "path": index_path}
else:
    @app.get("/")
    @app.head("/")
    async def root():
        return {"message": "Welcome to Genga Movie API", "frontend_missing": True, "frontend_path": frontend_dir}

@app.get("/api/health")
@app.head("/api/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    
    import uvicorn
    # Use the app object directly to avoid uvicorn's internal string-based re-import
    # which can fail on some standalone environments.
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1, log_level="info")

