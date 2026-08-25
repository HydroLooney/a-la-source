// Télécharge en local les images du corpus d'un atelier (offline-ready).
// Usage: node _dl-images.cjs [atelierId]  (défaut 3)
const https = require('https'), http = require('http'), fs = require('fs')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const atelierId = process.argv[2] || '3'
const extOf = ct => ct && ct.includes('png') ? 'png' : ct && ct.includes('webp') ? 'webp' : ct && ct.includes('gif') ? 'gif' : 'jpg'

function fetchJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej)
  })
}
function download(url, id, redir, cb) {
  if (redir > 5) return cb('too many redirects')
  const lib = url.startsWith('http:') ? http : https
  lib.get(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.google.com/' } }, r => {
    if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) { r.resume(); return download(new URL(r.headers.location, url).href, id, redir + 1, cb) }
    if (r.statusCode !== 200) { r.resume(); return cb('HTTP ' + r.statusCode) }
    const e = extOf(r.headers['content-type'] || '')
    const fn = 'db/image-cache/source-' + id + '.' + e
    const f = fs.createWriteStream(fn)
    r.pipe(f); f.on('finish', () => f.close(() => cb(null, fn, fs.statSync(fn).size, '/images/source-' + id + '.' + e)))
  }).on('error', e => cb(e.message))
}
(async () => {
  if (!fs.existsSync('db/image-cache')) fs.mkdirSync('db/image-cache', { recursive: true })
  const data = await fetchJson('http://localhost:3031/api/ateliers/' + atelierId)
  const sources = (data.sources || []).filter(s => s.image_url && s.image_url.startsWith('http'))
  const out = []
  for (const s of sources) {
    await new Promise(res => download(s.image_url, s.id, 0, (err, fn, size, iu) => {
      if (err) console.log(s.id, 'FAIL', err)
      else { console.log(s.id, 'OK', size, 'o ->', iu); out.push(s.id + ' ' + iu) }
      res()
    }))
  }
  fs.writeFileSync('db/image-cache/_mapping.txt', out.join('\n') + '\n')
  console.log('--- OK', out.length, '/', sources.length, '(mapping: db/image-cache/_mapping.txt)')
})()
