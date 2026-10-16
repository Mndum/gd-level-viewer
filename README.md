# GD Level Viewer

A view-only viewer for Geometry Dash level files, styled after the in-game editor.

- Opens `.gdlvl` and `.gmd` level files (drop one on the page, or Menu â†’ Open level).
- Draws the level with the real editor sprites, read from **your own** copy of the game.
- Build / Edit / Delete bar: the Build tab lists the object types in the level, the Edit tab shows
  the object you click (position, rotation, scale, colour channels, z layer, groups).
- Shader gallery: ten named image effects applied to the view, with Save PNG.
- UHD sprites by default, HD selectable.
- The level's Newgrounds song can be played (see below), and is dropped when you open another level.

It is read-only: it never modifies your files.

## Using it

1. Open the page in Chrome or Edge.
2. Menu â†’ **Choose Resources folderâ€¦** and pick your Geometry Dash `Resources` folder
   (for Steam: `steamapps/common/Geometry Dash/Resources`). The browser remembers the choice.
   Other browsers can use the plain folder picker, which cannot be remembered.
3. Open a level.

Everything happens in your browser. Your level and the game files are not uploaded anywhere.

## Songs

A web page cannot ask Geometry Dash's servers for a song by itself, so the page uses a tiny lookup
service ([`worker/song-service.worker.js`](worker/song-service.worker.js), a Cloudflare Worker).
It returns the song's name, artist and Newgrounds link; the audio then streams straight from
Newgrounds and is never stored. You can run your own copy and change the address in Menu â†’ Song,
or load an audio file yourself ("Load song fileâ€¦").

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
