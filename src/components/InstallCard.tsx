import { useState, type ReactNode } from 'react';
import { IS_ARTIFACT } from '../env';
import { platform, useInstall } from '../install';
import { Icon } from './icons';

const HIDE_KEY = 'vitalis-install-hidden-until';

function hiddenUntil(): number {
  try {
    return Number(localStorage.getItem(HIDE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

/** Invite à installer l'app (icône sur l'écran d'accueil), masquée une fois installée. */
export function InstallCard() {
  const { canPrompt, installed, install } = useInstall();
  const [hidden, setHidden] = useState(() => hiddenUntil() > Date.now());
  const [copied, setCopied] = useState(false);
  const p = platform();

  if (IS_ARTIFACT || installed || hidden) return null;
  if (p === 'desktop' && !canPrompt) return null;

  const later = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + 3 * 86_400_000));
    } catch {
      /* ignoré */
    }
    setHidden(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
    } catch {
      /* ignoré */
    }
  };

  let body: ReactNode;
  if (canPrompt) {
    body = (
      <button className="btn primary block" onClick={() => void install()}>
        <Icon.download /> Installer l’application
      </button>
    );
  } else if (p === 'android-webview') {
    body = (
      <>
        <p>Tu es dans le navigateur intégré d’une autre appli. Ouvre ce lien dans <b>Chrome</b> pour pouvoir installer Vitalis.</p>
        <button className="btn sm" onClick={copyLink}>
          <Icon.copy /> {copied ? 'Lien copié : colle-le dans Chrome' : 'Copier le lien'}
        </button>
      </>
    );
  } else if (p === 'android') {
    body = (
      <p>
        Dans Chrome : menu <b>⋮</b> en haut à droite → <b>« Installer l’application »</b> (ou « Ajouter à l’écran d’accueil » → <b>Installer</b>).
      </p>
    );
  } else {
    body = (
      <p>
        Dans <b>Safari</b> : bouton <b>Partager</b> (carré avec une flèche) → <b>« Sur l’écran d’accueil »</b> → Ajouter.
      </p>
    );
  }

  return (
    <div className="callout install">
      <img src="./icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 11, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title">Mets Vitalis sur ton écran d’accueil</div>
        <p>Une icône comme une vraie appli, en plein écran, qui marche même hors connexion.</p>
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {body}
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={later}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
