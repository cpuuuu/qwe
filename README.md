# I2PChat — Anonymous Chat over I2P

FastAPI website that looks and behaves like a real chat client. It connects
to the websocket exposed by the I2P router at `ws://127.0.0.1:9098`.

## How it works

- `GET /` serves the chat UI (FastAPI + Jinja2).
- The browser opens a websocket to the I2P router at `ws://127.0.0.1:9098`.
- The page sends events: `hello`, `message`, `typing`, `nick`, `ping`.
- It handles router events: `welcome`, `message`, `peer-join`, `peer-leave`,
  `peers`, `typing`, `pong`, `router-stats`, `error`.

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000 — it will try to dial the router websocket.
Make sure your I2P router exposes its websocket on port 9098.
