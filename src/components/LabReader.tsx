import { useRef, useState } from 'react';
import { IS_ARTIFACT } from '../env';
import { MARKERS } from '../lib/blood';
import { blobToBase64, CoachError, readLabReport, type LabReading } from '../lib/coach';
import { compressImage } from '../lib/photos';
import { useApp } from '../store';
import { Icon } from './icons';
import { Callout } from './ui';

const MAX_FILES = 8;
// Le base64 grossit d'un tiers : rester sous la limite de taille d'une requête
const MAX_BYTES = 18 * 1024 * 1024;

/** Lecture du compte-rendu du laboratoire (PDF ou photos des pages) par l'IA. */
export function LabReader({ onRead }: { onRead: (r: LabReading) => void }) {
  const { state } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKey = state.settings.anthropicKey;

  if (IS_ARTIFACT) return null;
  if (!apiKey)
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Astuce : avec ta clé API (Réglages → Coach IA), l’app lit directement le PDF ou la photo de ton compte-rendu et remplit tout.
      </p>
    );

  const run = async (list: FileList) => {
    const picked = [...list].slice(0, MAX_FILES);
    setError(null);
    if (picked.reduce((a, f) => a + f.size, 0) > MAX_BYTES) {
      setError('Fichiers trop lourds : envoie le PDF du laboratoire ou moins de photos.');
      return;
    }
    setBusy(true);
    try {
      const files: { mediaType: 'image/jpeg' | 'application/pdf'; data: string }[] = [];
      for (const f of picked) {
        if (f.type === 'application/pdf') files.push({ mediaType: 'application/pdf', data: await blobToBase64(f) });
        else files.push({ mediaType: 'image/jpeg', data: await blobToBase64(await compressImage(f, 2200)) });
      }
      const r = await readLabReport({
        apiKey,
        files,
        markers: MARKERS.map((m) => ({ id: m.id, name: m.name, unit: m.unit, altUnits: (m.altUnits ?? []).map((a) => a.unit) })),
      });
      if (!r.results.length) setError('Aucune des analyses suivies n’a été trouvée dans ce document. Vérifie qu’il s’agit bien des résultats, ou saisis-les à la main.');
      else onRead(r);
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Lecture impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void run(e.target.files);
          e.target.value = '';
        }}
      />
      <button className="btn primary block" disabled={busy} onClick={() => ref.current?.click()}>
        <Icon.sparkles /> {busy ? 'Lecture du compte-rendu…' : 'Lire mon compte-rendu (PDF ou photos)'}
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        Le PDF du laboratoire est le plus fiable. Sinon, une photo nette par page. Les valeurs lues s’affichent ci-dessous : vérifie-les avant d’enregistrer.
      </p>
      {error && (
        <Callout tone="critical" title="Oups">
          {error}
        </Callout>
      )}
    </div>
  );
}
