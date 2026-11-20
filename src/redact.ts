// RPC providers put API keys in the URL path or query (".../v2/<key>",
// "?apikey=..."), and ethers copies the request URL into its error messages.
// Anything logged or served by /health goes through here first.
const URL_PATTERN = /\b([a-z][a-z0-9+.-]*):\/\/(?:[^\s"'@/]*@)?([^\s"'/?#,)\]}]+)[^\s"',)\]}]*/gi

/** Keep only scheme and host of every URL in `text`. */
export function redactUrls(text: string): string {
    return text.replace(URL_PATTERN, (_m, scheme: string, host: string) => `${scheme}://${host}/<redacted>`)
}

/** The origin of a configured URL, safe to print. */
export function urlOrigin(url: string): string {
    try {
        const u = new URL(url)
        return `${u.protocol}//${u.host}`
    } catch {
        return "<invalid url>"
    }
}

export function errorMessage(err: unknown): string {
    return redactUrls(err instanceof Error ? err.message : String(err))
}
