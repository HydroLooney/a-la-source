// Repointage des image_url vers le cache local /images/ (offline-ready).
// Lit db/image-cache/_mapping.txt (id /images/source-<id>.<ext>) et met à jour la base canonique.
const Database = require('better-sqlite3')
const fs = require('fs')
const { join } = require('path')

const ONEDRIVE_ROOT = process.env.ONEDRIVE_ROOT || 'C:/Users/guillaume.barjot/OneDrive - ARTELIA'
const DB_PATH = process.env.A_LA_SOURCE_DB || join(ONEDRIVE_ROOT, '00_PERSO', 'A la source', 'a-la-source.db')

const lines = fs.readFileSync('db/image-cache/_mapping.txt', 'utf8').trim().split('\n').filter(Boolean)
const db = new Database(DB_PATH)
db.pragma('busy_timeout = 5000')

// On garde l'URL distante d'origine si une colonne dédiée existe, sinon on se
// contente de repointer image_url (le cache local prime, offline-ready).
const cols = db.prepare('PRAGMA table_info(sources)').all().map(c => c.name)
const hasOrig = cols.includes('image_url_origine')

const upd = db.prepare('UPDATE sources SET image_url = ? WHERE id = ?')
const tx = db.transaction(rows => {
  for (const l of rows) {
    const [id, iu] = l.split(' ')
    const before = db.prepare('SELECT image_url FROM sources WHERE id = ?').get(id)
    if (hasOrig && before && before.image_url && before.image_url.startsWith('http')) {
      db.prepare('UPDATE sources SET image_url_origine = COALESCE(image_url_origine, ?) WHERE id = ?').run(before.image_url, id)
    }
    upd.run(iu, id)
    console.log(id, (before && before.image_url || '').slice(0, 50), '->', iu)
  }
})
tx(lines)
db.close()
console.log('--- maj OK:', lines.length, 'sources | base:', DB_PATH)
