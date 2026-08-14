# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# collect_all ensures EVERY sub-module of fastapi and starlette is included
from PyInstaller.utils.hooks import collect_all, collect_submodules

fastapi_datas, fastapi_binaries, fastapi_hiddenimports = collect_all('fastapi')
starlette_datas, starlette_binaries, starlette_hiddenimports = collect_all('starlette')
ytdlp_datas, ytdlp_binaries, ytdlp_hiddenimports = collect_all('yt_dlp')
httpx_datas, httpx_binaries, httpx_hiddenimports = collect_all('httpx')
aiohttp_datas, aiohttp_binaries, aiohttp_hiddenimports = collect_all('aiohttp')
gaana_datas, gaana_binaries, gaana_hiddenimports = collect_all('gaanapy')
throttle_datas, throttle_binaries, throttle_hiddenimports = collect_all('throttlebuster')

a = Analysis(
    ['run_backend.py'],
    pathex=['backend'],
    binaries=[] + fastapi_binaries + starlette_binaries + ytdlp_binaries + httpx_binaries + aiohttp_binaries + gaana_binaries + throttle_binaries,
    datas=[
        ('backend', 'backend'),
    ] + fastapi_datas + starlette_datas + ytdlp_datas + httpx_datas + aiohttp_datas + gaana_datas + throttle_datas,
    hiddenimports=[
        'uvicorn',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.proactor',
        'pydantic',
        'pydantic.deprecated.json',
        'requests',
        'httpx',
        'anyio',
        'anyio._backends._asyncio',
        'h11',
        'aiohttp',
        'yt_dlp',
        'yt_dlp.extractor',
    ] + fastapi_hiddenimports + starlette_hiddenimports + ytdlp_hiddenimports + httpx_hiddenimports + aiohttp_hiddenimports + gaana_hiddenimports + throttle_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
