# CSS shadows to Figma styles

A [Figma](https://www.figma.com/) plugin that turns CSS [`box-shadow`](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow) values into **local effect styles** (drop and inner shadows). Paste shadow definitions from your codebase or design tokens, preview them, then create a named style in the current file. You can optionally generate **variables** for each shadow’s offset, blur, spread, and color in a chosen or new variable collection.

## Features

- **CSS-accurate parsing** — Multiple comma-separated shadows, `inset` inner shadows, and flexible token order (color, lengths, and `inset` can appear in different positions, per the CSS grammar).
- **Colors** — Hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), named CSS colors, `rgb()` / `rgba()` (legacy commas and modern space-separated syntax with `/` alpha), `hsl()` / `hsla()`, and `color-mix(in srgb, …)` for tokenized shadows from modern CSS.
- **Live preview** — See the shadow on a card in the plugin UI; adjust background and card colors to check contrast.
- **Effect styles** — Creates a Figma **effect style** with the parsed shadows.
- **Optional variables** — When enabled, creates `FLOAT` variables (x, y, blur, spread) and `COLOR` variables per shadow layer. The Figma Plugin API does not bind these variables to the style automatically; you’ll see a short notice after creation.

## Requirements

- [Node.js](https://nodejs.org/) (includes npm) — for installing dependencies and compiling TypeScript.
- Figma desktop or Figma in the browser.

## Setup

1. Clone this repository and open the project folder in a terminal.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile TypeScript to JavaScript (output: `code.js`, which is listed in `.gitignore`):

   ```bash
   npm run build
   ```

   For development, keep the compiler running while you edit:

   ```bash
   npm run watch
   ```

## Load the plugin in Figma

1. In Figma: **Plugins → Development → Import plugin from manifest…**
2. Choose the `manifest.json` file in this project’s root folder.
3. Run it via **Plugins → Development → CSS shadows to Figma styles** (or your imported plugin name).

Official plugin development docs: [Plugin quickstart guide](https://www.figma.com/plugin-docs/plugin-quickstart-guide/).

## Usage

1. Open the plugin.
2. Paste a CSS `box-shadow` value into **CSS Box Shadow**. You can paste the full declaration (e.g. `box-shadow: 0 4px 8px rgba(0,0,0,0.1);`) or just the value.
3. Enter a **Shadow name** for the new effect style.
4. Click **Preview** to validate parsing and preview the shadow. **Create style** unlocks after a successful preview.
5. Click **Create style** to add the effect style to the document.
6. (Optional) Check **Also create variables**, pick an existing variable collection or **New collection**, then create — variables are created for each shadow layer’s numeric and color channels.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Compile `code.ts` → `code.js` |
| `npm run watch` | Same as build in watch mode |
| `npm test` | Build, then run `test-parser.js` (parser unit checks) |
| `npm run lint` | ESLint on TypeScript sources |
| `npm run lint:fix` | ESLint with auto-fix |

## Project layout

| File | Role |
|------|------|
| `code.ts` | Plugin main thread: CSS parsing, Figma API (effect styles, variables) |
| `ui.html` | Plugin UI: textarea, preview, variable collection UI |
| `manifest.json` | Figma plugin manifest (`main`: `code.js`, `ui`: `ui.html`) |
| `test-parser.js` | Loads compiled `code.js` in Node with stubbed `figma` and asserts parser behavior |

## License

Add a license in `package.json` and/or a `LICENSE` file if you publish this project.
