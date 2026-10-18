# SHIFT ARENA — Playable Prototype v0.1

A neon mobile-landscape survival game. Includes a 60-second match, hex tile collapse, touch joystick, jump, 8-player online lobby and solo practice against seven server-controlled bots.

## Run

Install Python 3.10+ and then:

```bash
python -m pip install -r requirements.txt
python server.py
```

Open `http://localhost:8765` on your computer. For mobile testing on the same Wi-Fi, open `http://YOUR_COMPUTER_LOCAL_IP:8765` on your phone (allow the port through your firewall). **Do not expose this development server directly to the public internet.** For remote friends, deploy behind HTTPS/WSS on a properly configured host.

### Controls
- Touch: left virtual joystick, right JUMP button.
- Desktop: WASD/arrow keys to move, space to jump.
- **Play Now:** starts a practice game with seven bots.
- **Online Room:** share the six-character code; match starts at eight connected human players. Open different browsers/devices to test.

## Scope and limitations

This is a playable **browser-based prototype**, not a Unity project or installable Android/iOS application. It uses a stylized top-down canvas rendering rather than 3D assets. The server is authoritative over the match timer, tile state, elimination and winner. Movement validation, authentication, reconnects, cheat protection, persistence, lag compensation, matchmaking and production security are **not implemented**. Jump collision is deliberately simplified. The first version tests the core game loop and multiplayer concept, not production readiness.

No Meshy requests, paid services, or assets were used. The previously agreed 3D Game Rooms Function gate remains pending; this is an isolated mechanics proof of concept, not approval to advance that gated production pipeline.
