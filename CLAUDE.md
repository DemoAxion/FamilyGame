# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Arcade — a collection of classic arcade games built with vanilla HTML5 Canvas and JavaScript. No frameworks, no build tools, no dependencies.

## Running Games

Open any game's `index.html` directly in a browser. No build step or server required.

## Architecture

Each game lives in its own folder with two files:
- `index.html` — markup, embedded CSS, and canvas element
- `<game>.js` — all game logic, rendering, and input handling

Games are fully self-contained with no shared code between them.

**Current games:** `tetris/`, `pacman/`

## Conventions

- Pure vanilla JS (ES6+), no TypeScript, no npm
- All rendering uses HTML5 Canvas 2D context
- Game loops use `requestAnimationFrame`
- Retro arcade aesthetic: dark backgrounds, monospace fonts, neon accent colors
- Controls are keyboard-based (arrow keys primary)
- Persistent data (e.g., high scores) uses `localStorage`

## Adding a New Game

1. Create a folder named after the game
2. Add `index.html` with a canvas and embedded styles matching the arcade theme
3. Add `<game>.js` with the game loop, input handling, and rendering
4. Keep the game self-contained — no shared dependencies
