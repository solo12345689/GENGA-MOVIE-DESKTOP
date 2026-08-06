import sys
import traceback
import multiprocessing
import os

# FORCE IMPORT for PyInstaller detection
try:
    import fastapi.middleware.cors
    import uvicorn.protocols.http.auto
except ImportError:
    pass

# Panic Logging: Captures errors even before uvicorn starts
PANIC_LOG = os.path.join(os.environ.get('TEMP', ''), 'genga_panic.log')

def log_panic(msg):
    try:
        with open(PANIC_LOG, 'a') as f:
            f.write(f"[{os.getpid()}] {msg}\n")
    except:
        pass

def run():
    log_panic("Run function entered.")
    try:
        log_panic("Attempting to import uvicorn...")
        import uvicorn
        
        # Path setup
        backend_path = os.path.join(os.path.dirname(__file__), "backend")
        sys.path.insert(0, backend_path)
        log_panic(f"Backend path: {backend_path}")
        
        print(f"Starting backend on 127.0.0.1:8000...")
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
    except Exception:
        err = traceback.format_exc()
        log_panic(f"CRITICAL CRASH:\n{err}")
        with open("backend_error.log", "w") as f:
            f.write(err)
        print(err)

if __name__ == "__main__":
    log_panic("--- Backend Process Spawned ---")
    multiprocessing.freeze_support()
    run()
