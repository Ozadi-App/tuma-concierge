import { STORE_LINKS } from "../lib/stores";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 26" width="22" height="24" aria-hidden>
      <path d="M1.2.6 13.4 12.9 1.2 25.2C.8 25 .5 24.5.5 23.9V1.9c0-.6.3-1.1.7-1.3Z" fill="#00d7fe" />
      <path d="m17.5 8.8-4.1 4.1 4.1 4.1 4.7-2.7c1.3-.8 1.3-2.1 0-2.8l-4.7-2.7Z" fill="#ffce00" />
      <path d="M17.5 17 13.4 12.9 1.2 25.2c.5.5 1.2.5 2.1 0L17.5 17Z" fill="#ff3a44" />
      <path d="M17.5 8.8 3.3.6C2.4.1 1.7.1 1.2.6l12.2 12.3 4.1-4.1Z" fill="#00f076" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 384 512" width="20" height="24" aria-hidden fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function Badge({ href, icon, top, name }: { href: string | null; icon: React.ReactNode; top: string; name: string }) {
  const inner = (<>{icon}<span><small>{top}</small><b>{name}</b></span></>);
  return href ? (
    <a className="store-badge" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    <a className="store-badge" aria-disabled="true" role="link" tabIndex={0} title="Coming soon" data-soon="Coming soon">{inner}</a>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`store-badges ${className}`}>
      <Badge href={STORE_LINKS.play} icon={<PlayIcon />} top="GET IT ON" name="Google Play" />
      <Badge href={STORE_LINKS.apple} icon={<AppleIcon />} top="Download on the" name="App Store" />
    </div>
  );
}
