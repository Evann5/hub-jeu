// Photos d'avatar : le navigateur recadre et réduit l'image (carré de 256 px, JPEG), le serveur vérifie et la range dans data/photos.
// Chaque envoi a un nouveau nom au hasard : l'adresse change avec la photo, elle peut donc rester longtemps en cache.
// Les photos ne sont servies qu'aux personnes connectées (la page d'accueil publique n'en montre aucune).
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

export const PHOTO_MAX_BYTES = 150 * 1024;
export const photosDir = join(config.dataDir, 'photos');
const NAME_RE = /^\d+-[a-f0-9]{16}\.jpg$/;

export class PhotoError extends Error {}

// data URL « data:image/jpeg;base64,… » -> nom du fichier enregistré.
export function savePhoto(userId, dataUrl) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''));
  if (!match) throw new PhotoError('Image illisible : choisis une photo JPEG, PNG ou WebP.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > PHOTO_MAX_BYTES) throw new PhotoError('Photo trop lourde.');
  // Un vrai JPEG commence par FF D8 FF et finit par FF D9.
  if (bytes.length < 200 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    throw new PhotoError('Image illisible : choisis une autre photo.');
  }
  mkdirSync(photosDir, { recursive: true });
  const name = `${Number(userId)}-${randomBytes(8).toString('hex')}.jpg`;
  writeFileSync(join(photosDir, name), bytes);
  return name;
}

export function removePhoto(name) {
  if (name && NAME_RE.test(name)) rmSync(join(photosDir, name), { force: true });
}

export const validPhotoName = (name) => NAME_RE.test(String(name ?? ''));
