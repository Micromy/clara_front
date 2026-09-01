// DTCO Platform services. Shared by the platform shell and (later) the launcher.
// `pages` is the shell's page tab row for that service.
export const SERVICES = [
  {
    name: 'CLARA',
    dot: '#2f6fed',
    pages: [
      { label: 'PPA', to: '/' },
      { label: 'Library Report', to: '/library-report' },
    ],
  },
  { name: 'PAVE', dot: '#7a4fd6', pages: [] },
  { name: 'MHC', dot: '#c2632a', pages: [] },
]

export const CURRENT_SERVICE = 'CLARA'

// No auth source in this app yet. Placeholder only — the page is published to a
// public URL, so this must not be a real account id.
export const CURRENT_USER = 'demo.user'
