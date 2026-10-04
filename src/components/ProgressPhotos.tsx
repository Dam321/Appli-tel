import { useEffect, useMemo, useState } from 'react';
import { compressImage, deletePhoto, getPhoto, savePhoto } from '../lib/photos';
import type { ProgressPhoto } from '../lib/types';
import { formatDay, todayISO, uid } from '../lib/util';
import { useApp } from '../store';
import { Icon } from './icons';
import { Card, ConfirmButton, Segmented, Sheet } from './ui';

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
