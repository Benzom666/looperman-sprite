import { fetch } from "@tauri-apps/plugin-http"
import type { KeyCheck } from "$lib/freesound/verify"

/**
 * Splice needs no credentials, so there is nothing to validate. The only
 * failure mode is the endpoint being unreachable, which is worth telling the
 * user about clearly rather than letting the list render a bare error.
 */
export async function verifySpliceSource(): Promise<
    Exclude<KeyCheck, { status: "idle" }>
> {
    try {
        const response = await fetch(
            "https://surfaces-graphql.splice.com/graphql",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: "{__typename}" }),
            }
        )

        if (response.ok) return { status: "valid", account: null }

        if (response.status == 403) {
            return {
                status: "invalid",
                message:
                    "Splice's API is refusing this machine (HTTP 403). Their server is behind a bot check right now. Freesound works without it.",
            }
        }

        return {
            status: "invalid",
            message: `Splice returned ${response.status}. Try again in a moment.`,
        }
    } catch (error) {
        return {
            status: "invalid",
            message: `Could not reach Splice. ${(error as Error).message}`,
        }
    }
}
