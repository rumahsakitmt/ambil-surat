/** The app's mark: a letter with a QR corner. */
export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#0e6b5e" />
      <path d="M10 9.5h11l5 5V26a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 10 26Z" fill="#fff" />
      <path d="M21 9.5v5h5" fill="#b9dcd4" />
      <path d="M13.5 17.5h4v4h-4zm6 0h3v1.6h-3zm0 3h1.6v2.6h-1.6zm2.6 1h1v1.6h-1zm-8.6 2h4v1.2h-4z" fill="#0e6b5e" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className="text-lg font-semibold tracking-tight">Ambil Surat</span>
    </span>
  );
}
