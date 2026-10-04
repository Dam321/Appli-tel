import { useEffect, useMemo, useState } from 'react';
import { compressImage, deletePhoto, getPhoto, savePhoto } from '../lib/photos';
import { analyzePhysique, CoachError } from '../lib/coach';
import { coachSummary } from '../lib/derived';
import { PRIORITY_INFO } from '../lib/training';
import { IS_ARTIFACT } from '../env';
import { navigate } from '../App';
import type { ProgressPhoto } from '../lib/types';
import { formatDay, todayISO, uid } from '../lib/util';
import { useApp } from '../store';
import { Icon } from './icons';
import { Badge, Callout, Card, ConfirmButton, Segmented, Sheet } from './ui';

const ANGLES: { value: ProgressPhoto['angle']; label: string }[] = [
  { value: 'front', label: 'Face' },
  { value: 'side', label: 'Profil' },
  { value: 'back', label: 'Dos' },
];

function usePhotoUrl(id: string | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) return;
    let u: string | undefined;
    let alive = true;
    getPhoto(id)
      .then((b) => {
        if (b && alive) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url;
}

function Thumb({ photo, onClick }: { photo: ProgressPhoto; onClick?: () => void }) {
  const url = usePhotoUrl(photo.id);
  return (
    <button type="button" className="photo-thumb" onClick={onClick} aria-label={`Photo du ${photo.date}`}>
      {url ? <img src={url} alt="" /> : <span className="small muted">…</span>}
    </button>
  );
}

function PhysiqueAI() {
  const { state, update, derived, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = state.physiqueAnalysis;
  if (IS_ARTIFACT || !state.photos.length) return null;
  if (!state.settings.anthropicKey)
    return (
      <p className="small muted" style={{ marginBottom: 0 }}>
        Astuce : ajoute ta clé API dans Réglages pour une analyse IA de ta silhouette (proportions, posture, priorités).
      </p>
    );
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const latest = (['front', 'side', 'back'] as const)
        .map((angle) => state.photos.filter((x) => x.angle === angle).sort((x, y) => y.date.localeCompare(x.date))[0])
        .filter(Boolean);
      const photos = [];
      for (const ph of latest) {
        const blob = await getPhoto(ph.id);
        if (blob) photos.push({ angle: ANGLES.find((x) => x.value === ph.angle)!.label, date: ph.date, blob });
      }
      const result = await analyzePhysique({ apiKey: state.settings.anthropicKey!, photos, summary: coachSummary(state, derived) });
      update((s) => ({ ...s, physiqueAnalysis: { date: todayISO(), result } }));
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Analyse impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 10, marginTop: 12 }}>
      <button className="btn block" disabled={busy} onClick={run}>
        <Icon.sparkles /> {busy ? 'Analyse en cours…' : a ? 'Refaire l’analyse IA de ma silhouette' : 'Analyse IA de ma silhouette'}
      </button>
      {error && <Callout tone="critical" title="Oups">{error}</Callout>}
      {a && (
        <div className="ai-box">
          <div className="row between">
            <b>Analyse du {formatDay(a.date)}</b>
            <Badge tone="accent">{`≈ ${a.result.estimatedBodyFat} de gras`}</Badge>
          </div>
          <p className="small" style={{ margin: '6px 0' }}>
            {a.result.overall}
          </p>
          {a.result.strengths.length > 0 && (
            <p className="small" style={{ margin: '4px 0' }}>
              <b>Points forts :</b> {a.result.strengths.join(' · ')}
            </p>
          )}
          {a.result.weakPoints.length > 0 && (
            <p className="small" style={{ margin: '4px 0' }}>
              <b>À développer :</b> {a.result.weakPoints.join(' · ')}
            </p>
          )}
          {a.result.posture.length > 0 && (
            <p className="small" style={{ margin: '4px 0' }}>
              <b>Posture :</b> {a.result.posture.join(' · ')}
            </p>
          )}
          {a.result.actions.length > 0 && (
            <ul className="steps">
              {a.result.actions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {a.result.suggestedPriorities.length > 0 && (
            <button
              className="btn primary sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                update((s) => ({ ...s, profile: { ...s.profile!, priorities: a.result.suggestedPriorities } }));
                toast('Priorités appliquées : programme mis à jour');
                navigate('training');
              }}
            >
              Appliquer ces priorités : {a.result.suggestedPriorities.map((x) => PRIORITY_INFO[x].label).join(', ')}
            </button>
          )}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Tes dernières photos (face, profil, dos) et ton résumé sont envoyés à l’API Claude uniquement quand tu appuies sur ce bouton.
      </p>
    </div>
  );
}

export function ProgressPhotos() {
  const { state, update, toast } = useApp();
  const [angle, setAngle] = useState<ProgressPhoto['angle']>('front');
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const list = useMemo(() => state.photos.filter((p) => p.angle === angle).sort((a, b) => a.date.localeCompare(b.date)), [state.photos, angle]);
  const first = list[0];
  const last = list[list.length - 1];
  const firstUrl = usePhotoUrl(first?.id);
  const lastUrl = usePhotoUrl(last && last !== first ? last.id : undefined);
  const viewUrl = usePhotoUrl(viewing?.id);

  const add = async (file: File) => {
    try {
      const blob = await compressImage(file);
      const photo: ProgressPhoto = { id: uid(), date: todayISO(), angle };
      await savePhoto(photo.id, blob);
      update((s) => ({ ...s, photos: [...s.photos, photo] }));
      toast('Photo enregistrée sur ton téléphone');
    } catch {
      toast('Impossible d’enregistrer la photo');
    }
  };

  return (
    <Card title="Photos de progression" sub="La balance ne voit pas tout : compare ton physique de face, de profil et de dos.">
      <Segmented value={angle} onChange={setAngle} options={ANGLES} />
      {first && last && last !== first ? (
        <div className="photo-compare">
          <figure>
            {firstUrl && <img src={firstUrl} alt="Première photo" />}
            <figcaption>{formatDay(first.date, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption>
          </figure>
          <figure>
            {lastUrl && <img src={lastUrl} alt="Dernière photo" />}
            <figcaption>{formatDay(last.date, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption>
          </figure>
        </div>
      ) : (
        <p className="small text-2">Prends une photo de chaque angle maintenant, puis toutes les 4 semaines : l’app affichera l’avant/après.</p>
      )}
      {list.length > 0 && (
        <div className="photo-grid">
          {list
            .slice()
            .reverse()
            .map((p) => (
              <Thumb key={p.id} photo={p} onClick={() => setViewing(p)} />
            ))}
        </div>
      )}
      <label className="btn primary block" style={{ marginTop: 10 }}>
        <Icon.plus /> Ajouter une photo ({ANGLES.find((a) => a.value === angle)!.label.toLowerCase()})
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} />
      </label>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Même lumière, même heure (le matin à jeun), même pose, bras le long du corps. Les photos restent uniquement sur ce téléphone et ne sont pas incluses dans l’export.
      </p>
      <PhysiqueAI />
      {viewing && (
        <Sheet title={formatDay(viewing.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onClose={() => setViewing(null)}>
          {viewUrl && <img src={viewUrl} alt="" style={{ width: '100%', borderRadius: 12 }} />}
          <div style={{ marginTop: 12 }}>
            <ConfirmButton
              className="btn danger"
              label="Supprimer la photo"
              confirmLabel="Supprimer définitivement ?"
              onConfirm={() => {
                void deletePhoto(viewing.id);
                update((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== viewing.id) }));
                setViewing(null);
              }}
            >
              <Icon.trash /> Supprimer
            </ConfirmButton>
          </div>
        </Sheet>
      )}
    </Card>
  );
}
