// Locates the soffice binary. Not on PATH by default on Windows.
import { access } from 'node:fs/promises';

const CANDIDATES = [
  'soffice', // already on PATH, e.g. Linux/macOS installs
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
];

export async function findSoffice() {
  for (const candidate of CANDIDATES) {
    if (candidate === 'soffice') continue; // resolved by the shell at spawn time, not checkable here
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return 'soffice'; // last resort: let the shell resolve it, fail loudly if it can't
}
