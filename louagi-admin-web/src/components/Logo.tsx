// The Louagi mark — a stylized louage (shared taxi) on the brand-red disc.
// Vector-faithful port of louagi-app/assets/logo.svg so the admin and the
// mobile app share one identity.
export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Louagi"
    >
      <rect width="1024" height="1024" rx="236" fill="#C8102E" />
      <rect x="221" y="284" width="583" height="536" rx="79" fill="#031634" />
      <rect x="284" y="347" width="457" height="173" rx="24" fill="#fbf8fc" />
      <rect x="221" y="567" width="583" height="47" fill="#fbf8fc" />
      <circle cx="315" cy="725" r="39" fill="#fbf8fc" />
      <circle cx="709" cy="725" r="39" fill="#fbf8fc" />
    </svg>
  );
}
