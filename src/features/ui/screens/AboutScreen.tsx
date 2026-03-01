const GITHUB_URL = 'https://github.com/nicholasgriffintn/megawallet';
const ISSUES_URL = 'https://github.com/nicholasgriffintn/megawallet/issues';
const SECURITY_EMAIL = 'security@megawallet.dev';

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <span>{label}</span>
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 text-zinc-400"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function AboutScreen() {
  const version = chrome.runtime.getManifest().version;

  return (
    <div className="flex flex-1 flex-col items-center px-6 pt-12 pb-6">
      {/* Logo */}
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-lg">
        M
      </div>

      {/* Name + version */}
      <h1 className="text-lg font-bold">megawallet</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Version {version}</p>
      <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
        The fastest wallet for the fastest chain
      </p>

      {/* Links */}
      <div className="mt-8 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <LinkRow label="Source Code" href={GITHUB_URL} />
        <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />
        <LinkRow label="Report an Issue" href={ISSUES_URL} />
        <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />
        <LinkRow label="Security Contact" href={`mailto:${SECURITY_EMAIL}`} />
      </div>
    </div>
  );
}
