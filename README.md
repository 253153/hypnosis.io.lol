# hypnosis.io.lol

Induce a deep hypnotic state with this customizable brainwave entrainment app. Features synchronized visual stimuli and adjustable Theta (4–8 Hz) audio. Fine-tune the parameters to create your perfect trance or meditation experience.

**Repository:** [github.com/253153/hypnosis.io.lol](https://github.com/253153/hypnosis.io.lol)

## Project layout

| Path | Purpose |
|------|---------|
| `src/` | Source HTML, JavaScript, Web App Manifest, service worker, icons |
| `dist/` | **Static build output** — deploy this folder to any static host |
| `build.sh` | Copies `src/` → `dist/` (run before release) |

## Build

```bash
chmod +x build.sh
./build.sh
```

The deployable site is everything under **`dist/`** (`index.html`, `script.js`, `manifest.json`, `sw.js`, `robots.txt`, `icons/`).

Requirements for serving: **HTTPS** (or `localhost`) for the service worker and installable PWA; **WebGL 2** and **Web Audio** in the browser.

## Deploy

Point your host’s **publish directory** to `dist/` (or upload the contents of `dist/` to the server root). Examples:

- **Netlify / Cloudflare Pages / Vercel:** set root to repo base and **Publish directory** = `dist`
- **GitHub Pages:** use an Action that uploads `dist/`, or commit `dist/` and deploy that branch/folder

After deploy, set absolute `https://…` URLs in `index.html` for Open Graph / Twitter images if link previews need them (some crawlers ignore relative URIs).

## Shader

The fragment shader includes work by **Matthias Hurrle ([@atzedent](https://twitter.com/atzedent))** — keep attribution in `index.html` when redistributing.

## License

MIT — see [LICENSE](LICENSE).
