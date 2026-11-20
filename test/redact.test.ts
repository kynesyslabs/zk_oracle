import { describe, it, expect } from "bun:test"
import { errorMessage, redactUrls, urlOrigin } from "../src/redact"

const KEY = "s3cr3tK3y0123456789"

describe("redactUrls", () => {
    it("drops path, query and credentials from every URL", () => {
        const msg =
            `could not coalesce error (error={ "code": -32000 }, payload={ }, ` +
            `info={ "requestUrl": "https://eth-sepolia.g.alchemy.com/v2/${KEY}" }) ` +
            `and https://user:${KEY}@rpc.example:8545/path?apikey=${KEY}, http://node.example/zk/merkle-root?token=${KEY}`
        const out = redactUrls(msg)
        expect(out).not.toContain(KEY)
        expect(out).toContain("https://eth-sepolia.g.alchemy.com/<redacted>")
        expect(out).toContain("https://rpc.example:8545/<redacted>")
        expect(out).toContain("http://node.example/<redacted>")
        expect(out).toContain('"code": -32000')
    })

    it("leaves text without URLs alone", () => {
        expect(redactUrls("StaleRoot(100, 100)")).toBe("StaleRoot(100, 100)")
    })

    it("redacts error objects and keeps URL origins", () => {
        expect(errorMessage(new Error(`HTTP 500 from https://n.example/${KEY}/zk/merkle-root`))).not.toContain(KEY)
        expect(urlOrigin(`https://n.example:443/${KEY}?k=${KEY}`)).toBe("https://n.example")
    })
})
