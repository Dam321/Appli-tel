/**
 * Version « aperçu » publiée comme page claude.ai : pas de service worker ni d'appels
 * réseau externes (Withings, API Claude), qui ne fonctionnent que dans l'app installée.
 */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === '1';
export const INSTALLED_APP_URL = 'https://dam321.github.io/Appli-tel/';
