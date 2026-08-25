import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/client'
import SourceCard from '../components/cards/SourceCard'
import type { AtelierDetail, MecanismeReference, Source } from '../types'

interface ArchiveData {
  contenu: string | null
  type: string
}

type Phase = 'shortlist' | 'lecture' | 'synthese'

export default function Projection() {
  const { atelierId } = useParams<{ atelierId: string }>()
  const navigate = useNavigate()
  const [atelier, setAtelier] = useState<AtelierDetail | null>(null)
  const [phase, setPhase] = useState<Phase>('shortlist')
  const [sourceChoisie, setSourceChoisie] = useState<Source | null>(null)
  const [archiveContent, setArchiveContent] = useState<string | null>(null)
  const [archiveType, setArchiveType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Synthese state
  const [mecanismes, setMecanismes] = useState<MecanismeReference[]>([])
  const [selectedMecanismes, setSelectedMecanismes] = useState<Set<number>>(new Set())
  const [observationsSurprise, setObservationsSurprise] = useState('')
  const [questionsRestantes, setQuestionsRestantes] = useState('')
  const [nbParticipants, setNbParticipants] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!atelierId) return
    Promise.all([
      api.get<AtelierDetail>(`/ateliers/${atelierId}`),
      api.get<MecanismeReference[]>('/mecanismes'),
    ])
      .then(([atelierData, mecData]) => {
        setAtelier(atelierData)
        setMecanismes(mecData)
        // Pre-fill existing synthese data
        if (atelierData.observations_surprise) setObservationsSurprise(atelierData.observations_surprise)
        if (atelierData.questions_restantes) setQuestionsRestantes(atelierData.questions_restantes)
        if (atelierData.nb_participants) setNbParticipants(atelierData.nb_participants.toString())
        if (atelierData.mecanismes_identifies) {
          setSelectedMecanismes(new Set(atelierData.mecanismes_identifies.map(m => m.mecanisme_id)))
        }
      })
      .finally(() => setLoading(false))
  }, [atelierId])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const quitter = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate('/ateliers/en-cours')
  }

  // Choose source for reading
  const choisirSource = async (source: Source) => {
    setSourceChoisie(source)
    // Load archive content
    try {
      const detail = await api.get<{ archive: ArchiveData | null }>(`/sources/${source.id}`)
      setArchiveContent(detail.archive?.contenu || null)
      setArchiveType(detail.archive?.type || null)
    } catch {
      setArchiveContent(null)
      setArchiveType(null)
    }
    setPhase('lecture')
  }

  const retourShortlist = () => {
    setPhase('shortlist')
    setSourceChoisie(null)
    setArchiveContent(null)
    setArchiveType(null)
  }

  const allerSynthese = () => {
    setPhase('synthese')
  }

  const toggleMecanisme = (id: number) => {
    setSelectedMecanismes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sauverSynthese = async () => {
    if (!atelierId) return
    setSaving(true)
    try {
      await api.post(`/ateliers/${atelierId}/synthese`, {
        mecanisme_ids: Array.from(selectedMecanismes),
        observations_surprise: observationsSurprise || null,
        questions_restantes: questionsRestantes || null,
        nb_participants: nbParticipants ? parseInt(nbParticipants) : null,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="projection projection--light">
        <p className="projection-loading">Chargement de l'atelier...</p>
      </div>
    )
  }

  if (!atelier || atelier.sources.length === 0) {
    return (
      <div className="projection projection--light">
        <div className="projection-empty">
          <h2>Aucune source dans cet atelier</h2>
          <p>Ajoutez des sources depuis le pipeline Ateliers.</p>
          <button className="projection-btn" onClick={quitter}>Retour</button>
        </div>
      </div>
    )
  }

  const sources: Source[] = atelier.sources

  return (
    <div className="projection projection--light">
      {/* Control bar */}
      <div className="projection-controls projection-controls--light">
        <button className="projection-ctrl-btn" onClick={quitter} title="Quitter">
          Quitter
        </button>
        <span className="projection-ctrl-titre">
          A la source — Atelier #{atelier.numero}
          {phase === 'lecture' && sourceChoisie && ` — ${sourceChoisie.titre}`}
          {phase === 'synthese' && ' — Synthese'}
        </span>
        <div className="projection-ctrl-right">
          {phase === 'lecture' && (
            <button className="projection-ctrl-btn" onClick={retourShortlist}>
              Sources
            </button>
          )}
          {phase !== 'synthese' && (
            <button className="projection-ctrl-btn" onClick={allerSynthese}>
              Synthese
            </button>
          )}
          {phase === 'synthese' && (
            <button className="projection-ctrl-btn" onClick={retourShortlist}>
              Sources
            </button>
          )}
          <button className="projection-ctrl-btn" onClick={toggleFullscreen} title="Plein ecran">
            Plein ecran
          </button>
        </div>
      </div>

      {/* Phase 1: Shortlist — neutral card grid */}
      {phase === 'shortlist' && (
        <div className="projection-selection">
          <h2 className="projection-consigne">
            Quel sujet souhaitez-vous explorer aujourd'hui ?
          </h2>
          <div className="projection-grid">
            {sources.map((s) => (
              <SourceCard key={s.id} source={s} hideAttribution onOpen={choisirSource} />
            ))}
          </div>
        </div>
      )}

      {/* Phase 2: Lecture — archive reader, serif, light */}
      {phase === 'lecture' && sourceChoisie && (
        <div className="projection-lecture">
          <article className="projection-reader">
            <header className="projection-reader-header">
              <h1>{sourceChoisie.titre}</h1>
              <div className="projection-reader-meta">
                {sourceChoisie.media_nom && <span>{sourceChoisie.media_nom}</span>}
                {sourceChoisie.date_publication && (
                  <span>{new Date(sourceChoisie.date_publication).toLocaleDateString('fr-FR')}</span>
                )}
              </div>
            </header>

            {archiveContent ? (
              archiveType === 'markdown' ? (
                <div className="projection-reader-body">
                  <ReactMarkdown>{archiveContent}</ReactMarkdown>
                </div>
              ) : (
                <div
                  className="projection-reader-body"
                  dangerouslySetInnerHTML={{ __html: archiveContent }}
                />
              )
            ) : (
              <div className="projection-reader-fallback">
                {sourceChoisie.accroche && <p className="projection-reader-accroche">{sourceChoisie.accroche}</p>}
                <p className="projection-reader-notice">
                  Pas d'archive locale disponible pour cette source.
                </p>
              </div>
            )}
          </article>

          <div className="projection-lecture-nav">
            <button className="projection-btn projection-btn-secondary" onClick={retourShortlist}>
              Retour aux sources
            </button>
          </div>
        </div>
      )}

      {/* Phase 3: Synthese — guided form */}
      {phase === 'synthese' && (
        <div className="projection-synthese">
          <h2>Synthese de l'atelier</h2>

          <div className="synthese-section">
            <h3>Mecanismes identifies par le groupe</h3>
            <p className="synthese-hint">Cochez les mecanismes reperes collectivement pendant la discussion.</p>
            <div className="synthese-mecanismes-grid">
              {mecanismes.map(m => (
                <label key={m.id} className={`synthese-mecanisme ${selectedMecanismes.has(m.id) ? 'synthese-mecanisme--selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedMecanismes.has(m.id)}
                    onChange={() => toggleMecanisme(m.id)}
                  />
                  <span className="synthese-mecanisme-nom">{m.nom}</span>
                  {m.description && <span className="synthese-mecanisme-desc">{m.description.substring(0, 80)}...</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="synthese-section">
            <h3>Ce qui a surpris le groupe</h3>
            <textarea
              value={observationsSurprise}
              onChange={(e) => setObservationsSurprise(e.target.value)}
              placeholder="Reactions inattendues, decouvertes, prises de conscience..."
              rows={4}
            />
          </div>

          <div className="synthese-section">
            <h3>Questions restantes</h3>
            <textarea
              value={questionsRestantes}
              onChange={(e) => setQuestionsRestantes(e.target.value)}
              placeholder="Questions ouvertes, pistes a explorer..."
              rows={4}
            />
          </div>

          <div className="synthese-section synthese-participants">
            <label>
              <span>Nombre de participant·es</span>
              <input
                type="number" min={1}
                value={nbParticipants}
                onChange={(e) => setNbParticipants(e.target.value)}
              />
            </label>
          </div>

          <div className="synthese-actions">
            <button
              className="projection-btn projection-btn-primary"
              onClick={sauverSynthese}
              disabled={saving}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer la synthese'}
            </button>
            <button className="projection-btn projection-btn-secondary" onClick={retourShortlist}>
              Retour aux sources
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
