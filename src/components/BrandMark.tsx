/** Tiny terminal </> mark — matches public/favicon.svg. */
export function BrandMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="6" fill="currentColor" fillOpacity="0.22" />
      <rect x="4" y="5" width="24" height="22" rx="3" fill="currentColor" fillOpacity="0.18" />
      <circle cx="8" cy="9" r="1.1" fill="currentColor" fillOpacity="0.7" />
      <circle cx="11.5" cy="9" r="1.1" fill="currentColor" fillOpacity="0.45" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" fillOpacity="0.25" />
      <path
        d="M12.2 13.2 L8.6 16.5 L12.2 19.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.8 13.2 L23.4 16.5 L19.8 19.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.4 12.4 L14.6 20.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="21.5" y="22.2" width="4.5" height="1.6" rx="0.5" fill="currentColor" />
    </svg>
  )
}
