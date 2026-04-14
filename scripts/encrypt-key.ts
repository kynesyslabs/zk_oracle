#!/usr/bin/env bun
/**
 * One-time tool: encrypt a raw private key into an ethers.js JSON keystore.
 *
 * Usage:
 *   ORACLE_PRIVATE_KEY=0x... bun run scripts/encrypt-key.ts [output-path]
 *
 * Default output: oracle.keystore.json (chmod 600)
 *
 * After running:
 *   1. Set KEYSTORE_PATH=./oracle.keystore.json in .env
 *   2. Set KEYSTORE_PASSWORD=<your password> in .env
 *   3. Delete ORACLE_PRIVATE_KEY from your environment / shell history
 */
import { ethers } from "ethers"
import fs from "fs"

async function promptHidden(prompt: string): Promise<string> {
    process.stdout.write(prompt)

    if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    let input = ""
    return new Promise((resolve, reject) => {
        process.stdin.on("data", (char: string) => {
            switch (char) {
                case "\r":
                case "\n":
                    if (process.stdin.setRawMode) process.stdin.setRawMode(false)
                    process.stdin.pause()
                    process.stdout.write("\n")
                    resolve(input)
                    break
                case "\u0003": // Ctrl+C
                    process.stdout.write("\n")
                    process.exit(1)
                    break
                case "\u007f": // Backspace
                    input = input.slice(0, -1)
                    break
                default:
                    input += char
            }
        })
        process.stdin.on("error", reject)
    })
}

async function main() {
    const rawKey = process.env.ORACLE_PRIVATE_KEY
    if (!rawKey) {
        console.error("Error: Set ORACLE_PRIVATE_KEY env var to the key to encrypt.")
        console.error("  ORACLE_PRIVATE_KEY=0x... bun run scripts/encrypt-key.ts")
        process.exit(1)
    }

    let wallet: ethers.Wallet
    try {
        wallet = new ethers.Wallet(rawKey)
    } catch {
        console.error("Error: ORACLE_PRIVATE_KEY is not a valid private key.")
        process.exit(1)
    }

    const outputPath = process.argv[2] ?? "oracle.keystore.json"

    console.log(`Oracle address : ${wallet.address}`)
    console.log(`Output file    : ${outputPath}`)
    console.log()

    const password = await promptHidden("Keystore password : ")
    const confirm   = await promptHidden("Confirm password  : ")

    if (password !== confirm) {
        console.error("Passwords do not match.")
        process.exit(1)
    }
    if (password.length < 12) {
        console.error("Password must be at least 12 characters.")
        process.exit(1)
    }

    process.stdout.write("Encrypting (this takes ~1s)... ")
    const json = await wallet.encrypt(password)
    fs.writeFileSync(outputPath, json, { mode: 0o600 })
    console.log("done.\n")

    console.log(`Keystore saved : ${outputPath}`)
    console.log()
    console.log("Next steps:")
    console.log(`  1. Add to .env:  KEYSTORE_PATH=${outputPath}`)
    console.log(`  2. Add to .env:  KEYSTORE_PASSWORD=<your password>`)
    console.log(`  3. Remove ORACLE_PRIVATE_KEY from .env and shell history`)
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
