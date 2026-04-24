import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# Collect all pm4py submodules and data files (it has many dynamic imports)
hidden_pm4py   = collect_submodules("pm4py")
data_pm4py     = collect_data_files("pm4py")
hidden_pandas  = collect_submodules("pandas")
hidden_uvicorn = collect_submodules("uvicorn")
hidden_fastapi = collect_submodules("fastapi")

a = Analysis(
    ["server.py"],
    pathex=["."],
    binaries=[],
    datas=data_pm4py + [
        ("main.py", "."),          # include FastAPI routes alongside the binary
    ],
    hiddenimports=(
        hidden_pm4py
        + hidden_pandas
        + hidden_uvicorn
        + hidden_fastapi
        + ["uvicorn.logging", "uvicorn.loops", "uvicorn.loops.auto",
           "uvicorn.protocols", "uvicorn.protocols.http.auto",
           "uvicorn.protocols.websockets.auto", "uvicorn.lifespan.on"]
    ),
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name="server",
    debug=False,
    strip=False,
    upx=True,
    console=False,          # no console window in production
    icon=None,              # optionally point to a .ico file
)
