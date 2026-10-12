import { invoke } from "@tauri-apps/api/core"
import type {
    AssetCategorySlug,
    AssetFile,
    AssetSortType,
    AssetTag,
    Key,
    PackAsset,
    SampleAsset,
    SortOrder,
    TagSummaryEntry,
} from "$lib/splice/types"
import type { KeyCheck } from "$lib/freesound/verify"

const LOOPMAN_BASE = "https://www.looperman.com"
const LOOPMAN_LOOPS = `${LOOPMAN_BASE}/loops`
const LOOPMAN_LOGIN = `${LOOPMAN_BASE}` + "/account/login"

// ---------------------------------------------------------------- transport
//
// These go through Rust commands (see src-tauri/src/lib.rs) rather than the
// plugin-http fetch: the plugin builds a browser Request first, and the
// browser silently drops `Referer` and `Cookie` as forbidden headers.
// Looperman needs both (hotlink protection + login session).

type RustTextResponse = {
    status: number
    final_url: string
    body: string
    set_cookies: string[]
}

const loopermanText = (
    url: string,
    referer: string,
    fields?: Record<string, string>
): Promise<RustTextResponse> =>
    fields
        ? invoke("looperman_post", {
              url,
              referer,
              cookie: loopermanCookies ?? "",
              fields,
          })
        : invoke("looperman_text", {
              url,
              referer,
              cookie: loopermanCookies ?? "",
          })

const loopermanBytes = async (
    url: string,
    referer: string,
    accept: string
): Promise<Uint8Array> => {
    const bytes = await invoke<number[]>("looperman_bytes", {
        url,
        referer,
        cookie: loopermanCookies ?? "",
        accept,
    })
    return new Uint8Array(bytes)
}

// ---------------------------------------------------------------- session

// Session cookies captured at login (loop_session, loop_csrfc). Kept in
// memory only; the email + password live in the app config so we can
// re-login when the session expires.
let loopermanCookies: string | null = null

export const hasLoopermanSession = () => loopermanCookies != null

export const clearLoopermanSession = () => {
    loopermanCookies = null
}

const COOKIE_NAMES = ["loop_session", "loop_csrfc", "loop_remember"]

const collectCookies = (rawValues: string[], jar: Map<string, string>) => {
    for (const raw of rawValues) {
        for (const match of raw.matchAll(/([A-Za-z0-9_]+)=([^;,\s]+)/g)) {
            if (COOKIE_NAMES.includes(match[1])) jar.set(match[1], match[2])
        }
    }
}

const setCookieValues = (values: string[] | null | undefined): string[] => {
    if (!values) return []
    return values.filter((value) => typeof value == "string" && value)
}

/**
 * Logs into looperman.com with an email + password, keeping the session
 * cookies for authenticated listing fetches (which embed per-loop WAV
 * download tokens) and for the downloads themselves.
 */
export async function loginLooperman(
    email: string,
    password: string
): Promise<{ ok: boolean; message?: string }> {
    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
        return { ok: false, message: "Enter your Looperman email and password first." }
    }

    try {
        const jar = new Map<string, string>()

        const loginPage = await loopermanText(LOOPMAN_LOGIN, LOOPMAN_LOOPS)
        if (loginPage.status < 200 || loginPage.status >= 300) {
            return {
                ok: false,
                message: `Looperman login page failed (${loginPage.status}). Try again in a moment.`,
            }
        }
        collectCookies(setCookieValues(loginPage.set_cookies), jar)
        const form = loginPage.body
        const csrf = form.match(/name="csrftoken" value="([^"]+)"/)?.[1]
        const pageToken = form.match(/name="page_token" value="([^"]+)"/)?.[1]
        if (!csrf || !pageToken) {
            return {
                ok: false,
                message: `Could not read the Looperman login form (${loginPage.status}). Try again in a moment.`,
            }
        }

        const response = await loopermanText(LOOPMAN_LOGIN, LOOPMAN_LOGIN, {
            csrftoken: csrf,
            page_token: pageToken,
            user_email: cleanEmail,
            upass: password,
            user_disclaimer: "1",
            submit: "submit",
        })
        collectCookies(setCookieValues(response.set_cookies), jar)

        const responseBody = response.body
        if (
            responseBody.includes("Login Failed") ||
            response.final_url.includes("/account/login")
        ) {
            clearLoopermanSession()
            return {
                ok: false,
                message: "Looperman rejected this login. Check the email and password.",
            }
        }

        loopermanCookies = [...jar.entries()]
            .map(([k, v]) => `${k}=${v}`)
            .join("; ")
        if (!loopermanCookies) {
            return { ok: false, message: "Looperman did not return a session. Try again in a moment." }
        }
        return { ok: true }
    } catch (error) {
        clearLoopermanSession()
        return {
            ok: false,
            message: `Could not reach Looperman. ${(error as Error).message}`,
        }
    }
}

/**
 * Ensures an authenticated session when credentials are configured. Search
 * works without login (previews are public), but only an authenticated
 * listing page carries the per-loop WAV download tokens.
 */
export async function ensureLoopermanSession(
    email: string | null,
    password: string | null
) {
    if (hasLoopermanSession()) return true
    if (!email || !password) return false
    const result = await loginLooperman(email, password)
    if (!result.ok) console.warn("⚠️ Looperman login failed", result.message)
    return result.ok
}

export async function verifyLooperman(
    email: string,
    password: string
): Promise<Exclude<KeyCheck, { status: "idle" }>> {
    clearLoopermanSession()
    const result = await loginLooperman(email, password)
    return result.ok
        ? { status: "valid", account: email.trim() }
        : { status: "invalid", message: result.message ?? "Login failed." }
}

// ------------------------------------------------------------------ search

export type LoopermanFilterParams = {
    query: string
    tags: string[]
    key: string | null
    chord_type: string | null
    bpm: string | null
    min_bpm: number | null
    max_bpm: number | null
    asset_category_slug: AssetCategorySlug | null
}

export const loopermanTagUUID = (tag: string) => `looperman-tag-${tag}`

const stripTagPrefix = (uuid: string) => uuid.replace(/^looperman-tag-/, "")

// Looperman addresses keys as a lowercase note with "s" for sharp and a
// trailing "m" for minor: F# minor is "fsm", G major is "g".
export function toLoopermanKey(
    key: string | null,
    chord_type: string | null
): string | null {
    if (!key) return null
    const note = key.toLowerCase().replace("#", "s")
    if (!/^[a-g]s?$/.test(note)) return null
    return chord_type == "major" ? note : `${note}m`
}

const toLoopermanKeywords = (query: string, tags: string[]): string | null => {
    const terms: string[] = []
    for (const word of query.split(/\s+/)) {
        const clean = word.trim().toLowerCase()
        if (clean) terms.push(...clean.split(/\s+/))
    }
    for (const tag of tags) {
        const clean = stripTagPrefix(tag).trim().toLowerCase()
        if (clean) terms.push(...clean.split(/\s+/))
    }
    if (!terms.length) return null
    // "+" prefixes mean AND to Looperman's search.
    return terms.map((term) => `+${term}`).join("")
}

export function buildLoopermanQuery(
    params: LoopermanFilterParams & {
        page: number
        sort: AssetSortType
        order: SortOrder
    }
): string {
    const query = new URLSearchParams()

    const keywords = toLoopermanKeywords(params.query, params.tags)
    if (keywords) query.set("keys", keywords)

    if (params.bpm) {
        const bpm = Math.round(parseFloat(params.bpm))
        if (!Number.isNaN(bpm)) {
            query.set("ftempo", String(bpm))
            query.set("ttempo", String(bpm))
        }
    } else {
        if (params.min_bpm != null) query.set("ftempo", String(Math.round(params.min_bpm)))
        if (params.max_bpm != null) query.set("ttempo", String(Math.round(params.max_bpm)))
    }

    const mkey = toLoopermanKey(params.key, params.chord_type)
    if (mkey) query.set("mkey", mkey)

    // Looperman sorts server-side by date or download count only. Anything
    // else (including relevance, which is the default when keywords are
    // present) is left to the server default.
    const desc = params.order == "DESC"
    if (params.sort == "popularity") {
        query.set("order", "downloads")
        query.set("dir", desc ? "d" : "a")
    } else if (params.sort == "recency") {
        query.set("order", "date")
        query.set("dir", desc ? "d" : "a")
    }

    if (params.page > 1) query.set("page", String(params.page))

    return query.toString()
}

export type LoopermanLoop = {
    id: string
    title: string
    detailUrl: string
    author: string
    authorId: string
    mp3: string
    download: string | null
    waveform: string
    durationMs: number
    bpm: number | null
    key: Key | null
    chord_type: string | null
    genre: string | null
    category: string | null
    timeSig: string | null
    daw: string | null
    dateText: string | null
    downloads: number | null
    description: string | null
}

const LOOP_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

const parseLoopermanKey = (
    label: string | null
): { key: Key | null; chord_type: string | null } => {
    if (!label) return { key: null, chord_type: null }
    const match = label.trim().match(/^([A-G]#?)(m)?$/i)
    if (!match) return { key: null, chord_type: null }
    const key = match[1].toUpperCase()
    if (!LOOP_KEYS.includes(key)) return { key: null, chord_type: null }
    return { key: key as Key, chord_type: match[2] ? "minor" : "major" }
}

const firstGroup = (source: string, pattern: RegExp): string | null => {
    const match = source.match(pattern)
    return match ? match[1] : null
}

const cleanLabel = (label: string | null): string | null => {
    if (!label) return null
    return label.replace(/&amp;/g, "&").trim() || null
}

const parseLoopermanBlock = (block: string): LoopermanLoop | null => {
    const mp3 = firstGroup(block, /data-mp3="([^"]+)"/)
    // The title anchor carries both the detail URL and the player-title class;
    // attribute order is not guaranteed, so match loosely then verify. Later
    // anchors in the same block (e.g. the file-size link) reuse the detail
    // URL without the class, so scan all candidates.
    const candidates = [
        ...block.matchAll(
            /<a href="(https:\/\/www\.looperman\.com\/loops\/detail\/(\d+)\/[^"]*)"([^>]*)>([^<]+)<\/a>/g
        ),
    ]
    const detailMatch = candidates.find((anchor) =>
        anchor[3].includes("player-title")
    )
    if (!mp3 || !detailMatch) return null

    const detailUrl = detailMatch[1]
    const id = detailMatch[2]
    const title = cleanLabel(detailMatch[4]) ?? `Loop ${id}`

    const duration = parseFloat(firstGroup(block, /data-duration="([\d.]+)"/) ?? "")
    const authorMatch = block.match(
        /\/users\/profile\/(\d+)[^>]*>([^<]+)<\/a>/
    )
    const waveform =
        firstGroup(block, /src="([^"]+)" class="player-waveform-image"/) ??
        firstGroup(block, /class="player-waveform-image"[^>]*src="([^"]+)"/) ??
        ""
    const download = firstGroup(
        block,
        /(https:\/\/www\.looperman\.com\/getfiles\/loops\/v1-[A-Za-z0-9_\-]+)/
    )

    const bpmText = firstGroup(
        block,
        /ftempo=\d+[^>]*>(\d+)\s*bpm<\/a>/i
    )
    const genre = cleanLabel(
        firstGroup(block, /\/loops\/genres\/[^"]*"[^>]*>([^<]+)<\/a>/)
    )?.replace(/\s+Loops$/i, "") ?? null
    const category = cleanLabel(
        firstGroup(block, /\/loops\/cats\/[^"]*"[^>]*>([^<]+)<\/a>/)
    )?.replace(/\s+Loops$/i, "") ?? null
    const timeSig = cleanLabel(
        firstGroup(block, /[?&]tsig=[^"]*"[^>]*>([^<]+)<\/a>/)
    )
    const daw = cleanLabel(
        firstGroup(block, /[?&]did=\d+[^"]*"[^>]*>([^<]+)<\/a>/)
    )
    const keyLabel = cleanLabel(
        firstGroup(block, /[?&]mkey=[^"]*"[^>]*>Key\s*:\s*([^<]+)<\/a>/i)
    )
    const { key, chord_type } = parseLoopermanKey(keyLabel)
    const dateText = cleanLabel(
        firstGroup(
            block,
            /(\d{1,2}(?:st|nd|rd|th) \w+ \d{4} \d{2}:\d{2})/
        )
    )
    const downloadsText = firstGroup(block, /data-bs-title="(\d+)\s*downloads"/)
    const description = cleanLabel(
        firstGroup(block, /Description\s*:\s*(.*?)<\/div>/s)
    )

    return {
        id,
        title,
        detailUrl,
        author: cleanLabel(authorMatch?.[2] ?? null) ?? "Looperman",
        authorId: authorMatch?.[1] ?? "0",
        mp3,
        download,
        waveform,
        durationMs: Number.isNaN(duration) ? 0 : Math.round(duration * 1000),
        bpm: bpmText ? parseInt(bpmText, 10) : null,
        key,
        chord_type,
        genre,
        category,
        timeSig,
        daw,
        dateText,
        downloads: downloadsText ? parseInt(downloadsText, 10) : null,
        description,
    }
}

/**
 * Parses a Looperman loops listing page. Each loop renders exactly one
 * `player-wrapper` div carrying the preview MP3 + duration; the tag row
 * below it carries bpm / genre / category / key, and (when logged in) the
 * download button carries the WAV token URL.
 */
export function parseLoopermanListing(html: string): {
    items: LoopermanLoop[]
    total: number
} {
    const blocks = html.split('<div class="player-wrapper"').slice(1)
    const items: LoopermanLoop[] = []
    for (const block of blocks) {
        const loop = parseLoopermanBlock(block)
        if (loop) items.push(loop)
    }

    // The count renders as "Loops </span> 1 - 25 of 2,102": markup sits
    // between the label and the numbers, so allow tags in between.
    const totalMatch = html.match(
        /Loops?(?:\s|<[^>]+>)+\d+\s*-\s*\d+\s+of\s+([\d,]+)/i
    )
    const total = totalMatch
        ? parseInt(totalMatch[1].replace(/,/g, ""), 10)
        : items.length

    return { items, total }
}

export const loopermanSoundUUID = (id: string) => `looperman-${id}`

export function toSampleAsset(loop: LoopermanLoop): SampleAsset {
    const pack: PackAsset = {
        uuid: `looperman-user-${loop.authorId}`,
        name: loop.author,
        permalink_slug: loop.authorId,
        permalink_base_url: loop.author,
        url: `https://www.looperman.com/users/profile/${loop.authorId}`,
        files: [
            {
                uuid: `looperman-pack-image-${loop.id}`,
                path: "",
                asset_file_type_slug: "image",
                url: loop.waveform,
                __typename: "AssetFile",
            },
        ],
        __typename: "PackAsset",
    }

    const files: AssetFile[] = [
        {
            uuid: `looperman-preview-${loop.id}`,
            name: loop.title,
            path: "",
            asset_file_type_slug: "preview",
            url: loop.mp3,
            __typename: "AssetFile",
        },
        {
            uuid: `looperman-waveform-${loop.id}`,
            path: "",
            asset_file_type_slug: "waveform",
            url: loop.waveform,
            __typename: "AssetFile",
        },
    ]

    // The authenticated listing page embeds a per-loop WAV token URL. It is
    // session-bound, so it is refreshed on every search rather than cached.
    if (loop.download) {
        files.push({
            uuid: `looperman-download-${loop.id}`,
            name: loop.title,
            path: "",
            asset_file_type_slug: "original",
            url: loop.download,
            __typename: "AssetFile",
        })
    }

    const tagLabels = [
        loop.genre,
        loop.category,
        loop.daw,
        loop.timeSig,
    ].filter((label): label is string => !!label)
    const tags: AssetTag[] = tagLabels.map((label) => ({
        uuid: loopermanTagUUID(label),
        label,
        __typename: "AssetTag",
    }))

    return {
        source: "looperman",
        asset_type_slug: "sample",
        asset_prices: [{ amount: 0, currency: "LM", __typename: "AssetPrice" }],
        uuid: loopermanSoundUUID(loop.id),
        name: loop.title,
        tags,
        files,
        parents: { items: [pack], __typename: "AssetParentPage" },
        bpm: loop.bpm ?? undefined,
        key: loop.key ?? undefined,
        chord_type: loop.chord_type ?? undefined,
        duration: loop.durationMs,
        asset_category_slug: "loop",
        __typename: "SampleAsset",
    }
}

/**
 * Looperman has no tag facet endpoint, so we tally genres + categories of
 * the page we just received, same as the Freesound path.
 */
export function deriveLoopermanTagSummary(
    loops: LoopermanLoop[]
): TagSummaryEntry[] {
    const counts = new Map<string, number>()
    for (const loop of loops) {
        for (const label of [loop.genre, loop.category]) {
            if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
        }
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 32)
        .map(([label, count]) => ({
            count,
            tag: {
                uuid: loopermanTagUUID(label),
                label,
                taxonomy: {
                    uuid: "looperman-taxonomy",
                    name: "Genre",
                    __typename: "TagTaxonomy",
                },
                __typename: "AssetTag",
            },
            __typename: "TagSummaryEntry",
        }))
}

// ------------------------------------------------------------------- fetch

export type LoopermanSearchParams = LoopermanFilterParams & {
    page: number
    page_size: number
    sort: AssetSortType
    order: SortOrder
}

export async function searchLooperman(params: LoopermanSearchParams) {
    const queryString = buildLoopermanQuery(params)
    const url = queryString ? `${LOOPMAN_LOOPS}?${queryString}` : LOOPMAN_LOOPS
    const startTime = Date.now()
    console.log("💌 Requesting Looperman", queryString || "(latest)")

    const response = await loopermanText(url, LOOPMAN_LOOPS)
    if (response.status < 200 || response.status >= 300) {
        console.error(
            "Looperman search failed",
            response.status,
            response.body.slice(0, 300)
        )
        throw new Error(`Looperman search failed (${response.status})`)
    }

    const { items, total } = parseLoopermanListing(response.body)
    console.log(
        "📬 Received",
        items.length,
        "Looperman loops after",
        Date.now() - startTime,
        "ms"
    )

    return { items, total }
}

/**
 * Preview MP3 bytes. Looperman requires a looperman.com Referer, which the
 * app webview never sends, so previews are fetched through Rust into a blob
 * URL rather than handed to <audio> raw.
 */
export async function fetchLoopermanPreview(url: string): Promise<Blob> {
    const bytes = await loopermanBytes(url, `${LOOPMAN_BASE}/`, "audio/mpeg")
    return new Blob([bytes as BlobPart], { type: "audio/mpeg" })
}

/**
 * Full-quality WAV bytes via the session-bound download token URL scraped
 * from the listing page. Throws when the session or token expired so the
 * caller can fall back to the preview MP3.
 */
export async function fetchLoopermanWav(
    downloadUrl: string,
    detailUrl: string
): Promise<Blob> {
    const bytes = await loopermanBytes(
        downloadUrl,
        detailUrl,
        "audio/wav,audio/*;q=0.9,*/*;q=0.8"
    )
    // A WAV starts with RIFF; anything else is an error page in disguise.
    const magic = String.fromCharCode(...bytes.slice(0, 4))
    if (magic != "RIFF") {
        throw new Error("Looperman download expired (login page returned)")
    }
    return new Blob([bytes as BlobPart], { type: "audio/wav" })
}
