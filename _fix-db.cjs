// Répare l'état journal de la base canonique : merge le WAL dans la base puis
// force le mode DELETE (sidecars -wal/-shm supprimés). Préserve les écritures.
const Database = require('better-sqlite3')
const { join } = require('path')
const ONEDRIVE_ROOT = process.env.ONEDRIVE_ROOT || 'C:/Users/guillaume.barjot/OneDrive - ARTELIA'
const DB_PATH = process.env.A_LA_SOURCE_DB || join(ONEDRIVE_ROOT, '00_PERSO', 'A la source', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('busy_timeout = 15000')
console.log('journal_mode avant :', db.pragma('journal_mode', { simple: true }))
try { console.log('checkpoint :', JSON.stringify(db.pragma('wal_checkpoint(TRUNCATE)'))) } catch (e) { console.log('checkpoint err', e.message) }
console.log('journal_mode après DELETE :', db.pragma('journal_mode = DELETE', { simple: true }))
// Sanity : les 8 images sont bien locales ?
const n = db.prepare("SELECT COUNT(*) c FROM sources WHERE image_url LIKE '/images/%'").get()
console.log('sources image locale /images/ :', n.c)
db.close()
console.log('--- DB OK')
