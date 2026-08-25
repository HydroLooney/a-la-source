import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { existsSync } from 'fs'
import { DB_PATH } from '../db/dbPath.js'

// Chemin de la base : resolu de maniere UNIQUE dans db/dbPath.ts (une seule base,
// canonique, dans OneDrive). Tous les scripts seed/migrate s'y referent aussi.
if (!existsSync(DB_PATH)) {
  console.error(`Base introuvable : ${DB_PATH}`)
  console.error('Lancer : npm run init-db')
  process.exit(1)
}

const db: DatabaseType = new Database(DB_PATH)
// Attente sur verrou avant tout pragma : la base canonique vit sur OneDrive et
// peut etre momentanement verrouillee (synchro cloud, lecture par le MCP
// sqlite-vault...). Sans busy_timeout, le moindre verrou fait planter le demarrage
// avec SQLITE_BUSY. On laisse jusqu'a 15 s au verrou pour se liberer.
db.pragma('busy_timeout = 15000')
// Base canonique sur OneDrive : le mode WAL y est incompatible (les sidecars -wal/-shm
// sont desynchronises par la synchro cloud => "database disk image is malformed" et
// regressions de donnees). On force le mode DELETE (journal rollback classique).
// Si un autre lecteur tient la base en WAL et empeche la bascule, on ne CRASHE PAS :
// on demarre quand meme (hors-ligne, sans synchro cloud, le WAL est sans danger ;
// la bascule en DELETE se refera au prochain demarrage non verrouille).
try {
  const mode = db.pragma('journal_mode = DELETE', { simple: true })
  if (mode !== 'delete') {
    console.warn(`[db] journal_mode=${mode} (bascule DELETE non aboutie, base verrouillee). Demarrage tolere.`)
  }
} catch (e) {
  console.warn(`[db] Impossible de basculer en DELETE (${(e as Error).message}). Demarrage tolere.`)
}
db.pragma('foreign_keys = ON')

export default db
