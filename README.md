# GD Level Viewer

View and edit Geometry Dash level files in your browser, in the style of the in-game editor.

- Opens `.gdlvl` and `.gmd` level files (drop one on the page, or Menu → Open level).
- Draws the level with the real editor sprites, read from **your own** copy of the game.
- Build / Edit / Delete bar: the Build tab lists the object types in the level, the Edit tab shows
  the selected object (position, rotation, scale, colour channels, z layer, groups).
- **Editing:** select objects (Shift-click for several), drag them in Move mode with grid snapping,
  nudge, rotate, flip, scale, duplicate, delete, and undo/redo (Ctrl+Z / Ctrl+Y).
- **Saving:** Menu → Save edited level downloads a *new* file in the same format. Your original is
  never changed. Edited levels have not been tested inside Geometry Dash itself, so keep your original.
- Shader gallery: ten named image effects applied to the view, with Save PNG.
- UHD sprites by default, HD selectable.
- The level's Newgrounds song can be played (see below), and is dropped when you open another level.

## Using it

1. Open the page in Chrome or Edge.
2. Menu → **Choose Resources folder…** and pick your Geometry Dash `Resources` folder
   (for Steam: `steamapps/common/Geometry Dash/Resources`). The browser remembers the choice.
   Other browsers can use the plain folder picker, which cannot be remembered.
3. Open a level.

Everything happens in your browser. Your level and the game files are not uploaded anywhere.

## Songs

A web page cannot ask Geometry Dash's servers for a song by itself, so the page uses a tiny lookup
service ([`worker/song-service.worker.js`](worker/song-service.worker.js), a Cloudflare Worker).
It returns the song's name, artist and Newgrounds link; the audio then streams straight from
Newgrounds and is never stored. You can run your own copy and change the address in Menu → Song,
or load an audio file yourself ("Load song file…").

## What is and isn't in this repository

- This repository contains **no game assets**: no sprites, fonts, audio or shader code from
  Geometry Dash. Sprites are read from the user's own installation at runtime.
- `index.html` includes a table that maps object IDs to sprite file names, which is how the page
  knows which sprite to draw for an object.
- The effect shader is original code.

## Disclaimer

Unofficial fan tool. Not affiliated with, endorsed by, or sponsored by RobTop Games.
Geometry Dash and its artwork are the property of RobTop Games.

## License

The code in this repository is MIT licensed (see [LICENSE](LICENSE)). The licence covers this project's own code only; it grants no rights to Geometry Dash, its artwork, or anything else owned by RobTop Games.