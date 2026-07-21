/**
 * Optional fire-and-forget ping after adding an application.
 * Calls an Apps Script Web App that runs repository_dispatch
 * (empty commit only — no application fields).
 *
 * Must be a GET: Apps Script /exec rejects sendBeacon's POST (HTTP 405).
 * An Image request follows redirects without CORS issues from GitHub Pages.
 */
export async function pingGithubApplicationAdded(): Promise<void> {
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
  console.info('[github ping] Triggering application-added ping (GET)')

  await new Promise<void>((resolve) => {
    const img = new Image()
    const done = () => resolve()
    img.onload = done
    img.onerror = done // JSON response isn't an image; request still completed
    img.src = href
    window.setTimeout(done, 5000)
  })
}
