import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import { EnCoursPilote } from './Ateliers'
import type { AtelierDetail } from '../types'
import '../styles/ateliers-encours.css'

/* ===========================================================================
 * PAGE ATELIER : fiche dédiée d'un atelier (corpus sélectionné, avancement,
 * projection, synthèse). Réutilise EnCoursPilote, le même bloc de pilotage que
 * la sous-vue « en cours », mais sur sa propre route /atelier/:id.
 * =========================================================================== */

export default function AtelierFiche() {
  const { id } = useParams<{ id: string }>()
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  const [atelier, setAtelier] = useState<AtelierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [introuvable, setIntrouvable] = useState(false)

  const recharger = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.get<AtelierDetail>(`/ateliers/${id}`)
      setAtelier(data)
      setIntrouvable(false)
    } catch {
      setIntrouvable(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { recharger() }, [recharger])

  const changerStatut = async (atelierId: number, statut: string) => {
    await api.patch(`/ateliers/${atelierId}`, { statut })
    await recharger()
  }
  const terminerAtelier = async (atelierId: number) => {
    await api.patch(`/ateliers/${atelierId}`, { statut: 'termine' })
    await recharger()
  }
  const enregistrerSynthese = async (atelierId: number, fields: Record<string, unknown>) => {
    await api.post(`/ateliers/${atelierId}/synthese`, fields)
    await recharger()
  }

  if (loading) {
    return (
      <div className="page-ateliers">
        <p className="loading">Chargement...</p>
      </div>
    )
  }

  if (introuvable || !atelier) {
    return (
      <div className="page-ateliers">
        <section className="atelier-section">
          <p className="empty">Atelier introuvable.</p>
          <Link to="/ateliers/en-cours" className="btn btn-primary">Retour aux ateliers</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page-ateliers">
      <section className="atelier-section encours-vue">
        <Link to="/ateliers/en-cours" className="atelier-fiche-retour">
          <ArrowLeft size={16} /> Tous les ateliers
        </Link>
        <EnCoursPilote
          atelier={atelier}
          isFacilitateur={isFacilitateur}
          onChangeStatut={changerStatut}
          onSaveSynthese={enregistrerSynthese}
          onTerminer={terminerAtelier}
        />
      </section>
    </div>
  )
}
