# backend/server.py
#
# Responsibility: start and stop the FastAPI server as a subprocess.
# main.py stays untouched — this file is only called by electron/main.js
# (or directly from the terminal during development).
#
# Usage:
#   python server.py            → starts uvicorn on port 8000
#   python server.py --port 9000
#
# When packaged with PyInstaller the compiled binary runs this entry point.

import argparse
import subprocess
import sys
import os


def get_uvicorn_path() -> str:
    """
    Returns the path to the uvicorn executable.
    Works both in a normal venv and inside a PyInstaller bundle.
    """
    if getattr(sys, "frozen", False):
        # Running inside a PyInstaller .exe — uvicorn is bundled alongside
        base = sys._MEIPASS  # type: ignore[attr-defined]
        return os.path.join(base, "uvicorn")
    # Normal development environment
    return "uvicorn"


def start_server(host: str = "127.0.0.1", port: int = 8000) -> subprocess.Popen:
    """
    Spawn uvicorn as a child process pointing at main:app.
    Returns the Popen handle so the caller can kill it on exit.
    """
    uvicorn = get_uvicorn_path()
    cmd = [
        uvicorn,
        "main:app",
        "--host", host,
        "--port", str(port),
        "--log-level", "warning",   # keep stdout clean in production
    ]

    # In production (frozen) we hide the console window on Windows
    creation_flags = 0
    if sys.platform == "win32" and getattr(sys, "frozen", False):
        creation_flags = subprocess.CREATE_NO_WINDOW

    process = subprocess.Popen(
        cmd,
        cwd=os.path.dirname(os.path.abspath(__file__)),  # always run from backend/
        creationflags=creation_flags,
    )
    return process


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start the FastAPI backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    proc = start_server(host=args.host, port=args.port)
    print(f"[server.py] FastAPI running on http://{args.host}:{args.port} (PID {proc.pid})")

    try:
        proc.wait()          # block until uvicorn exits
    except KeyboardInterrupt:
        proc.terminate()
        print("[server.py] Stopped.")