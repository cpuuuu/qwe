from contextlib import asynccontextmanager
from pathlib import Path
import os
import subprocess

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).parent

ROUTER_WS_URL = "ws://127.0.0.1:9098"
ROUTER_BIN = BASE_DIR / "assets" / "i2p-router"

_router_proc: subprocess.Popen | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _router_proc
    os.chmod(ROUTER_BIN, 0o755)
    _router_proc = subprocess.Popen([str(ROUTER_BIN)])
    yield
    if _router_proc is not None:
        _router_proc.terminate()
        try:
            _router_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _router_proc.kill()
        _router_proc = None


app = FastAPI(title="I2PChat", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        request, "index.html", {"router_ws_url": ROUTER_WS_URL}
    )


@app.get("/health")
def health():
    running = _router_proc is not None and _router_proc.poll() is None
    return {"status": "ok", "router_ws": ROUTER_WS_URL, "router_running": running}
