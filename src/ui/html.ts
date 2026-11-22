import { crewArt, crewIndex } from './crew';
import type { PowerKind, QuestionType } from '../rules/config';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function avatar(color: string, extraClass = ''): string {
  return `<span class="avatar ${extraClass}" style="--crew:${color}" aria-hidden="true">${crewArt(crewIndex(color))}</span>`;
}

export function fuelCans(n: number, of = 3): string {
  return `<span class="fuel" role="img" aria-label="${n} of ${of} fuel cans">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}

const INK = '#26212B';
export function typeIcon(t: QuestionType, color = INK, size = 12): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true"`;
  switch (t) {
    case 'mcq':
      return `<svg ${s}><circle cx="3" cy="3" r="2" fill="${color}"/><circle cx="9" cy="3" r="2" fill="${color}"/><circle cx="3" cy="9" r="2" fill="${color}"/><circle cx="9" cy="9" r="2" fill="${color}"/></svg>`;
    case 'fill':
      return `<svg ${s}><rect x="0" y="9" width="12" height="2.5" rx="1" fill="${color}"/><rect x="0" y="2" width="5" height="2.5" rx="1" fill="${color}"/></svg>`;
    case 'pattern':
      return `<svg ${s}><rect x="0" y="8" width="3" height="4" fill="${color}"/><rect x="4.5" y="4.5" width="3" height="7.5" fill="${color}"/><rect x="9" y="0" width="3" height="12" fill="${color}"/></svg>`;
    case 'word':
      return `<svg ${s}><rect x="0" y="1" width="12" height="2" rx="1" fill="${color}"/><rect x="0" y="5" width="12" height="2" rx="1" fill="${color}"/><rect x="0" y="9" width="7" height="2" rx="1" fill="${color}"/></svg>`;
  }
}

export function powerIcon(p: PowerKind): string {
  const s = 'width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="#FFC23D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  if (p === 'jump') return `<svg ${s}><path d="M4 16c3-8 9-11 14-11M13 3l5 2-2 5"/></svg>`;
  if (p === 'shield') return `<svg ${s}><path d="M11 2l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V5z"/></svg>`;
  return `<svg ${s}><path d="M18 11H5M10 6l-5 5 5 5"/></svg>`;
}

export const pauseIcon = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="11" y="2" width="4" height="14" rx="1.5" fill="currentColor"/></svg>`;

export const diceIcon = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="2" y="2" width="22" height="22" rx="6" fill="none" stroke="#26212B" stroke-width="2.5"/><circle cx="8.5" cy="8.5" r="2" fill="#26212B"/><circle cx="13" cy="13" r="2" fill="#26212B"/><circle cx="17.5" cy="17.5" r="2" fill="#26212B"/></svg>`;

export const introArt = `<svg width="390" height="470" viewBox="0 0 390 470" aria-hidden="true">
<rect width="390" height="470" fill="#2C2532"/>
<circle cx="210" cy="70" r="46" fill="#4A4252" opacity="0.8"/><circle cx="258" cy="46" r="34" fill="#4A4252" opacity="0.6"/><circle cx="168" cy="40" r="28" fill="#4A4252" opacity="0.55"/>
<circle cx="200" cy="168" r="80" fill="#FF6A2B" opacity="0.35"/>
<polygon points="-20,420 160,166 240,166 420,420" fill="#3A3242"/><polygon points="200,166 240,166 420,420 290,420" fill="#2F2936"/>
<ellipse cx="200" cy="166" rx="40" ry="9" fill="#FF6A2B"/>
<path d="M180 172 C 160 230, 120 300, 70 420" stroke="#FF6A2B" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M220 172 C 236 240, 262 320, 300 420" stroke="#FF8A3D" stroke-width="6" stroke-linecap="round" fill="none"/>
<circle cx="150" cy="130" r="4" fill="#FFC23D"/><circle cx="248" cy="120" r="3" fill="#FFC23D"/><circle cx="184" cy="104" r="2.5" fill="#FFC23D"/>
<rect x="0" y="400" width="390" height="70" fill="#0F4F73"/>
<path d="M318 384v34" stroke="#fff" stroke-width="2.5"/><path d="M321 388l18 24h-18z" fill="#fff"/><path d="M298 420h48l-7 12h-34z" fill="#2BA8E0"/>
<path d="M352 390v28" stroke="#fff" stroke-width="2"/><path d="M354 394l14 18h-14z" fill="#fff"/><path d="M338 420h40l-6 10h-28z" fill="#2BA8E0"/>
</svg>`;

export const overArt = `<svg width="390" height="300" viewBox="0 0 390 300" aria-hidden="true">
<polygon points="-40,230 30,130 70,130 150,230" fill="#3A3242"/><ellipse cx="50" cy="130" rx="20" ry="5" fill="#FF6A2B"/><circle cx="50" cy="108" r="20" fill="#4A4252" opacity="0.6"/>
<rect x="0" y="226" width="390" height="74" fill="#0B3F5E"/>
<path d="M232 90v130" stroke="#fff" stroke-width="4"/><path d="M237 98l70 104h-70z" fill="#fff"/><path d="M228 108l-56 94h56z" fill="#CDE9F7"/>
<path d="M150 220h170l-24 36H174z" fill="#2BA8E0"/><path d="M232 90l26 8-26 8z" fill="#FFC23D"/>
</svg>`;
