"use client";

/*
 * Last-resort error boundary. It replaces the root layout entirely, so the
 * application's stylesheet, theme provider and branding are all unavailable
 * here. Styles are therefore inlined and dark mode is handled by
 * `prefers-color-scheme` rather than the usual `.dark` class, so the page
 * cannot render as a white flash for a dark-mode user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body>
        <style>{`
          :root {
            --bg: #f9f9fa;
            --fg: #131315;
            --muted: #6b6b75;
            --border: #e4e4e8;
            --card: #ffffff;
            --accent: #4f46e5;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0a0a0b;
              --fg: #f3f3f5;
              --muted: #9a9aa5;
              --border: #26262b;
              --card: #121214;
              --accent: #7b74ee;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            background: var(--bg);
            color: var(--fg);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          .panel { max-width: 26rem; text-align: center; }
          h1 {
            margin: 0 0 .5rem;
            font-size: 1.125rem;
            font-weight: 600;
            letter-spacing: -0.02em;
          }
          p { margin: 0; font-size: .875rem; line-height: 1.6; color: var(--muted); }
          .digest {
            margin-top: .75rem;
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: .75rem;
            color: var(--muted);
            opacity: .7;
          }
          .actions { margin-top: 1.25rem; display: flex; gap: .5rem; justify-content: center; }
          button {
            font: inherit;
            font-size: .875rem;
            font-weight: 500;
            padding: .5rem 1rem;
            border-radius: .625rem;
            cursor: pointer;
            border: 1px solid transparent;
            transition: opacity .15s ease;
          }
          button:hover { opacity: .9; }
          .primary { background: var(--accent); color: #fff; }
          .secondary { background: var(--card); color: var(--fg); border-color: var(--border); }
        `}</style>

        <div className="panel">
          <h1>Si è verificato un errore</h1>
          <p>
            Qualcosa è andato storto. Prova a ricaricare la pagina; se il
            problema persiste, contatta l&apos;assistenza.
          </p>
          {error.digest && <p className="digest">{error.digest}</p>}
          <div className="actions">
            <button className="primary" onClick={() => reset()}>
              Riprova
            </button>
            <button
              className="secondary"
              onClick={() => (window.location.href = "/")}
            >
              Torna al login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
