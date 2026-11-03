# Hush, Then Bloom

A small, wordless journey made for **thatgamejam #02** (thatgamecompany), whose theme is a piece of music.

In the hush of a sleeping world you are a single small light. Wake the other lights, carry them through the dark and the cold wind, and bring them home to the great tree in time for the music to bloom.

- Play in the browser / download for Windows: https://rajeshmullippa.itch.io/hush-then-bloom
- Jam: https://itch.io/jam/thatgamejam02

## Controls
- Move: mouse or touch (your light follows the pointer), or WASD / arrow keys
- Hold and release (click or Space) to sing; release as the heartbeat ring closes to sing brighter
- F (browser) / F11 (desktop) for fullscreen

## How it maps to the theme
The track moves from a quiet, searching opening into a steady, growing pulse that swells and then lets go. The game has three movements: **hush** (a dark meadow), **pulse** (a heartbeat you sing with as you climb), and **bloom** (the finale, where the theme track plays unmodified and every light you carried blossoms on the tree on the music's accents).

## Running
- Web: put the jam's theme track as `web/theme.mp3` (download it from the jam page) and open `web/index.html`, or serve the folder.
- Desktop (Electron): copy `web/` into `electron/web/`, then in `electron/`: `npm i -D electron @electron/packager` and `npx @electron/packager . HushThenBloom --platform=win32 --arch=x64`.

## Tech
Plain JavaScript + HTML5 canvas, no libraries. Every visual and every sound effect / ambient tone is procedural (Web Audio). The Windows build wraps the web build with Electron.

## AI disclosure
This game contains AI-generated content. It was made by Rajesh Mullippa with **Hark, an AI agent**. Hark designed the game and wrote all of the code; all visuals, ambient music and sound effects are generated procedurally by that code. The theme track (by Jason Grace) is the jam's official track, used unmodified inside the jam entry only, and is not included in this repository.

## Credits
Made by Rajesh Mullippa with Hark, an AI agent. Theme music: Jason Grace.
