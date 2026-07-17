import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname, normalize, sep } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = process.env.TRIMPS_GAME_DIR || '/Users/matt/dev/MattAltermatt/trimps-game'
const PORT = Number(process.env.PORT || 8080)

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    // Alias: our build artifact, served alongside the game.
    const bundlePath = resolve(ROOT, 'dist/autotrimps.user.js')
    const filePath = url === '/autotrimps.dev.js'
      ? bundlePath
      : resolve(GAME, '.' + normalize(url === '/' ? '/index.html' : url))
    // Containment guard: resolve() collapses `..`, so a prefix check keeps every
    // served path inside the game dir (or the one aliased bundle) — no traversal.
    if (filePath !== bundlePath && !filePath.startsWith(GAME + sep)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    const body = await readFile(filePath)
    // Never cache: this is a dev server rebuilt constantly. Without this the browser caches
    // /autotrimps.dev.js and serves a STALE bundle across reloads / new incognito windows (the
    // script tag has no cache-buster) — silently masking every fresh build.
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate',
      pragma: 'no-cache',
      expires: '0',
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}/  (game: ${GAME})`))
