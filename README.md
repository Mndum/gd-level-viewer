# GD Level Viewer

View and edit Geometry Dash level files in your browser, in the style of the in-game editor.

- Opens `.gdlvl` and `.gmd` level files (drop one on the page, or Menu → Open level).
- Draws the level with the real editor sprites. Don't have the game? [Get Geometry Dash on Steam](https://store.steampowered.com/app/322170/Geometry_Dash/).
- Build / Edit / Delete bar: the Build tab lists the object types in the level, the Edit tab shows
  the selected object (position, rotation, scale, colour channels, z layer, groups).
- **Editing:** select objects (Shift-click for several), drag them in Move mode with grid snapping,
  nudge, rotate, flip, scale, duplicate, delete, and undo/redo (Ctrl+Z / Ctrl+Y).
- **Saving:** Menu → Save edited level downloads a *new* file in the same format. Your original is
  never changed. Edited levels have not been tested inside Geometry Dash itself, so keep your original.
- **Trigger timeline:** a bar under the view plays or scrubs through the level. Colour triggers apply as you scroll, like the editor; tick Preview for the rest. Colour, pulse, move, alpha, toggle, rotate, scale, spawn, camera (zoom, offset, rotation) and shader triggers take effect, with easing; the level's own background and ground pictures and colours are drawn. Hover or select a trigger to see what it does. Shader strength is approximate, and other trigger types are described but not simulated.
- **Playable cube:** the Play button in the timeline bar runs a cube through the level (hold Space, Up or the mouse to jump, Esc to stop). The movement follows the game's player physics; it covers the cube in classic mode, solid blocks, slopes (bugged) , spikes, speed and gravity portals, and basic pads (blue pads are also bugged) and orbs, and ignores other vehicles and moving objects.
- Shader gallery: ten named image effects applied to the view, with Save PNG.
- UHD sprites by default, HD selectable.
- The level's song plays from your own game folder (see below) and is dropped when you open another level.

## Using it

1. Open the page in Chrome or Edge.
2. Sprites load automatically. Optional: Menu -> **Use my own game folder instead...** to read them from your installed game
   (Chrome and Edge will not open folders under `Program Files`).
3. Open a level.

Everything happens in your browser. Your level and the game files are not uploaded anywhere.

## Songs

Newgrounds does not allow other sites to stream its audio, so this page never does. Instead:

- Geometry Dash saves every song it downloads as `<song id>.mp3` in `%LOCALAPPDATA%\GeometryDash`.
  Menu → Song → **Choose game save folder…** (once; the browser remembers it) and the page plays the
  level's song from there. The song is kept in memory only and dropped when you open another level.
- Or use **Load song file…** with any audio file.
- A small lookup service ([`worker/song-service.worker.js`](worker/song-service.worker.js), a Cloudflare
  Worker) is used only to show the song's name and artist, and the page links to the song's Newgrounds page.
  You can run your own copy and change the address in Menu → Song.
## What is and isn't in this repository

- `assets/` contains Geometry Dash's sprite sheets and fonts, No audio from the game is included.
- `index.html` includes a table that maps object IDs to sprite file names, which is how the page
  knows which sprite to draw for an object.

## Disclaimer

Unofficial fan tool. Not affiliated with, endorsed by, or sponsored by RobTop Games.
Geometry Dash and its artwork are the property of RobTop Games.

## License

The code in this repository is MIT licensed (see [LICENSE](LICENSE)). The licence covers this project's own code only; it grants no rights to Geometry Dash, its artwork, or anything else owned by RobTop Games.
