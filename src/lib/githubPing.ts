/**
 * Optional fire-and-forget ping after adding an application.
 * Calls an Apps Script Web App that runs repository_dispatch
 * (empty commit only — no application fields).
 *
 * Apps Script /exec only accepts GET (POST → 405). Use several GET
 * strategies because GitHub Pages → script.google.com can be flaky
 * with a single method (Image / fetch / iframe).
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
  url.searchParams.set('_', String(Date.now()))
  const secret = String(import.meta.env.VITE_GITHUB_PING_SECRET ?? '').trim()
  if (secret) {
    url.searchParams.set('secret', secret)
  }

  const href = url.toString()
  console.info('[github ping] Triggering application-added ping', url.pathname)

  // 1) no-cors GET (opaque response is fine — we only need the request to hit GAS)
  try {
    void fetch(href, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      keepalive: true,
    })
  } catch {
    // ignore
  }

  // 2) hidden iframe navigation (historically most reliable for Apps Script)
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
    iframe.src = href
    document.body.appendChild(iframe)
    window.setTimeout(() => {
      iframe.remove()
    }, 15000)
  } catch {
    // ignore
  }

  // 3) Image GET as another beacon
  try {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.src = href
  } catch {
    // ignore
  }
}
