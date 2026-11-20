"""Desktop launcher: the entry point for JobProgress.exe.

Starts the API (which also serves the React app) on a free local port and opens it
in a chromeless Edge/Chrome app window. Closing that window shuts the server down.
"""

import json
import os
import shlex
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser
from pathlib import Path

from db import app_data_dir

APP_TITLE = "Job Progress"
DATA_DIR = app_data_dir()
INSTANCE_FILE = DATA_DIR / "instance.json"
LOG_FILE = DATA_DIR / "jobprogress.log"


def message_box(text: str, error: bool = False) -> None:
    if os.name == "nt":
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, text, APP_TITLE, 0x10 if error else 0x40)
    else:
        print(text, file=sys.stderr)


def redirect_missing_stdio() -> None:
    """A windowed exe has no console, so sys.stdout/stderr are None. Send output to a log file."""
    if sys.stdout is None or sys.stderr is None:
        log = open(LOG_FILE, "a", buffering=1, encoding="utf-8")
        sys.stdout = sys.stdout or log
        sys.stderr = sys.stderr or log


def find_browser() -> str | None:
    """Edge or Chrome, both of which support app windows via --app."""
    candidates: list[str] = []
    if os.name == "nt":
        import winreg

        for exe in ("msedge.exe", "chrome.exe"):
            for root in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                try:
                    key = rf"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{exe}"
                    with winreg.OpenKey(root, key) as k:
                        candidates.append(winreg.QueryValue(k, None))
                except OSError:
                    pass
        for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
            if base:
                candidates.append(os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
                candidates.append(os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"))
    return next((c for c in candidates if c and os.path.isfile(c.strip('"'))), None)


def open_app_window(browser: str, url: str) -> subprocess.Popen:
    args = [
        browser.strip('"'),
        f"--app={url}",
        f"--user-data-dir={DATA_DIR / 'browser-profile'}",  # own profile, so we can tell when the window closes
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1280,860",
        *shlex.split(os.environ.get("JOBPROGRESS_BROWSER_ARGS", "")),  # extra flags, used for testing
    ]
    return subprocess.Popen(args)


def running_instance_url() -> str | None:
    """URL of an already-running copy of the app, if there is one."""
    try:
        url = json.loads(INSTANCE_FILE.read_text())["url"]
        with urllib.request.urlopen(f"{url}api/health", timeout=1) as res:
            if json.load(res).get("app") == "JobProgress":
                return url
    except Exception:
        pass
    return None


def run() -> None:
    browser = find_browser()

    existing = running_instance_url()
    if existing:
        # Already running: just bring up another window on it.
        if browser:
            open_app_window(browser, existing)
        else:
            webbrowser.open(existing)
        return

    import uvicorn

    from main import app

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))  # any free port
    url = f"http://127.0.0.1:{sock.getsockname()[1]}/"

    server = uvicorn.Server(uvicorn.Config(app, log_config=None, loop="asyncio", http="h11", ws="none", lifespan="on"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()

    deadline = time.monotonic() + 20
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError(f"The server didn't start. See {LOG_FILE}")
        time.sleep(0.05)

    INSTANCE_FILE.write_text(json.dumps({"url": url, "pid": os.getpid()}))
    try:
        if browser:
            started = time.monotonic()
            open_app_window(browser, url).wait()
            # If the browser exited right away it handed the window to a browser process that was
            # already open, so we can't tell when it closes. Keep serving until the user quits.
            if time.monotonic() - started < 3:
                message_box(f"{APP_TITLE} is running.\n\nClick OK when you're done to shut it down.")
        else:
            webbrowser.open(url)
            message_box(f"{APP_TITLE} is running at {url}\n\nClick OK when you're done to shut it down.")
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        INSTANCE_FILE.unlink(missing_ok=True)


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    redirect_missing_stdio()
    try:
        run()
    except Exception as exc:
        traceback.print_exc()
        message_box(f"{APP_TITLE} couldn't start:\n\n{exc}\n\nDetails are in {LOG_FILE}", error=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
