# MOCK GTA — Terminal City

A top-down 2D open-world **GTA-style sandbox** built with **pure HTML, CSS and JavaScript** — no frameworks, no assets, no build step. All art is canvas-drawn, all audio is synthesized live with WebAudio.

## Run it

Open `index.html` in any modern browser (double-click works — no server needed).

Optional, for a local server:

```
npx serve .        # or: python -m http.server
```

## What's inside

| System | Details |
|---|---|
| City | 96×96 tile procedural city: roads, sidewalks, buildings, parks, parking lots, plaza |
| Driving | Real top-down car physics — lateral grip, handbrake drifts, skid marks, damage, explosions |
| Life | Traffic AI with lanes and intersections, wandering pedestrians, carjackable cars |
| Heat | 5-star wanted system: pursuing squad cars (BFS pathfinding), foot cops, busts, shooting at 3★ |
| Missions | Hot Wheels (steal & deliver), Pizza Rush (timed multi-stop), Clean Getaway (lose the heat) |
| Feelings recorder | Live commentary feed of the driver's emotions + timestamped session log (📼) with JSON export |
| PRO DEMO | A built-in autopilot that *plays the game at pro level* — steals a car, drifts downtown, raises heat, loses the cops and completes a mission, narrating its feelings in realtime |
| Extras | Day/night cycle with headlights & streetlamps, cinematic camera, minimap, synth engine/siren/gunshot audio |

## Controls

- **WASD / arrows** — move & drive &nbsp;•&nbsp; **E** — enter/exit car &nbsp;•&nbsp; **SPACE** — handbrake
- **Click** — shoot &nbsp;•&nbsp; **H** — horn &nbsp;•&nbsp; **V** — cinematic cam &nbsp;•&nbsp; **M** — mute &nbsp;•&nbsp; **ESC** — pause

## Recording gameplay

Click **★ WATCH PRO DEMO** on the title screen: the AI plays a full pro run while the
feelings feed narrates every drift, near-miss, star and payday. The **📼 Session Recorder**
keeps the full timestamped emotion log and can save it as `mock-gta-session.json`.
