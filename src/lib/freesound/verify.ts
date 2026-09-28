import { fetch } from "@tauri-apps/plugin-http"

export type KeyCheck =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "valid"; account: string | null }
    | { status: "invalid"; message: string }

/**
 * Validates a Freesound API key against the live API rather than guessing from
 * its shape, so the user finds out before they start searching.
 */
export async function verifyFreesoundKey(
    key: string
): Promise<Exclude<KeyCheck, { status: "idle" }>> {
    const trimmed = key.trim()
    if (!trimmed) return { status: "invalid", message: "Enter a key first." }

    if (/\s/.test(trimmed)) {
        return {
            status: "invalid",
            message:
                "Keys have no spaces. Copy only the Client secret / Api key field.",
        }
    }

    if (trimmed.includes("/")) {
        return {
            status: "invalid",
            message:
                "That looks like the whole credential pair. Keep only the part before the slash.",
        }
    }

    try {
        const response = await fetch(
            "https://freesound.org/apiv2/search/?query=a&fields=id&page_size=1",
            { headers: { Authorization: `Token ${trimmed}` } }
        )

        if (response.status == 401) {
            return {
                status: "invalid",
                message: "Freesound rejected this key. Check you copied it fully.",
            }
        }

        if (!response.ok) {
            return {
                status: "invalid",
                message: `Freesound returned ${response.status}. Try again in a moment.`,
            }
        }

        return { status: "valid", account: null }
    } catch (error) {
        return {
            status: "invalid",
            message: `Could not reach Freesound. ${(error as Error).message}`,
        }
    }
}
