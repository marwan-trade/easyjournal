import { useId } from 'react';

/** Monogramme EJ : cercle doré, lettres E et J, courbe de gain. */
export default function Logo({ size = 30, title = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd878" /><stop offset="1" stopColor="#e08a00" /></linearGradient></defs>
      <circle cx="32" cy="32" r="27" fill="none" stroke={`url(#${id})`} strokeWidth="3" />
      <path d="M20 20v24M20 20h14M20 32h11M20 44h14" stroke={`url(#${id})`} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M37 42l6-8 4 3 6-10" fill="none" stroke={`url(#${id})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
