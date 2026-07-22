/**
 * After adding an application, ask GitHub to run the empty-commit workflow.
 * No application fields are sent — only event_type "application-added".
 *
 * Uses repository_dispatch directly (Apps Script redirects are unreliable
 * from GitHub Pages). Requires build-time secrets:
 *   VITE_GH_PAT        — classic PAT with `repo` (same as Actions GH_PAT)
 *   VITE_GITHUB_REPO   — "owner/repo" (set automatically in deploy.yml)
 */
export async function pingGithubApplicationAdded(): Promise<void> {
  const token = String(import.meta.env.VITE_GH_PAT ?? '').trim()
  const repo = String(import.meta.env.VITE_GITHUB_REPO ?? '').trim()

  if (!token || !repo) {
    console.warn(
      '[github ping] Missing VITE_GH_PAT or VITE_GITHUB_REPO in this build. ' +
        'Add Actions secret GH_PAT and redeploy.',
    )
    return
  }

  const url = `https://api.github.com/repos/${repo}/dispatches`
  console.info('[github ping] Dispatching application-added to', repo)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'application-added',
      client_payload: {
        source: 'internship-apps-tracker',
        timestamp: new Date().toISOString(),
      },
    }),
  })

  // 204 No Content = success
  if (res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => '')
    console.error('[github ping] Failed', res.status, text.slice(0, 200))
    throw new Error(`GitHub dispatch failed (${res.status})`)
  }

  console.info('[github ping] OK — Application ping workflow should start')
}
