/**
 * Optional fire-and-forget ping after adding an application.
 * Calls an Apps Script Web App that runs repository_dispatch
 * (empty commit only — no application fields).
 *
 * Prefer sendBeacon / Image over fetch: Apps Script /exec URLs redirect,
 * and browser CORS often blocks a normal fetch from GitHub Pages.
 */
export async function pingGithubApplicationAdded(): Promise<void> {
  // Keep as runtime reads so a missing secret doesn't erase the whole helper at build time.
  const base = String(import.meta.env.VITE_GITHUB_PING_URL ?? '').trim()
  if (!base) {
    console.warn(
      '[github ping] Not configured in this build (VITE_GITHUB_PING_URL was empty at deploy).',
    )
    return
  }

  const url = new URL(base)
  url.searchParams.set('ping', '1')
  url.searchParams.set('event', 'application-added')
  const secret = String(import.meta.env.VITE_GITHUB_PING_SECRET ?? '').trim()
  if (secret) {
    url.searchParams.set('secret', secret)
  }

  const href = url.toString()
  console.info('[github ping] Triggering application-added ping')

  // 1) sendBeacon (best-effort, survives page transitions)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(href)
      if (ok) {
        return
      }
    }
  } catch {
    // fall through
  }

  // 2) Image GET — reliably follows Apps Script redirects without CORS
  await new Promise<void>((resolve) => {
    const img = new Image()
    const done = () => resolve()
    img.onload = done
    img.onerror = done
    img.src = href
    window.setTimeout(done, 4000)
  })
}
