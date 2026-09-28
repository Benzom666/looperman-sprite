import { fetch } from "@tauri-apps/plugin-http"
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
import type { FreesoundSearchResponse, FreesoundSound } from "./types"

const FREESOUND_API_BASE = "https://freesound.org/apiv2"

// Only ask for what Splicerr actually renders, plus the content-based
// descriptors that stand in for Splice's key / bpm / category metadata.
const SEARCH_FIELDS = [
    "id",
    "name",
    "tags",
    "duration",
    "username",
    "license",
    "created",
    "num_downloads",
    "avg_rating",
    "previews",
    "images",
    "pack",
    "pack_name",
    "url",
    "note_name",
    "tonality",
    "bpm",
    "loopable",
    "single_event",
]

const MAX_TAG_SUMMARY = 32

const FREESOUND_KEYS = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
]

// Splice and Freesound disagree on how to spell these, so we keep the two
// vocabularies apart and translate at the edge.
export const freesoundTagUUID = (tag: string) => `freesound-tag-${tag}`
export const freesoundSoundUUID = (id: number) => `freesound-${id}`

const stripTagPrefix = (uuid: string) => uuid.replace(/^freesound-tag-/, "")

let freesoundApiKey: string | null = null

export function setFreesoundApiKey(key: string | null) {
    freesoundApiKey = key?.trim() || null
}

// ---------------------------------------------------------------- filters

export type FreesoundFilterParams = {
    query: string
    tags: string[]
    key: string | null
    chord_type: string | null
    bpm: string | null
    min_bpm: number | null
    max_bpm: number | null
    asset_category_slug: AssetCategorySlug | null
}

/**
 * Translates Splicerr's filter state into a Solr filter expression.
 * Returns an empty string when nothing should be filtered.
 */
export function buildFreesoundFilter(params: FreesoundFilterParams): string {
    const clauses: string[] = []

    for (const tag of params.tags) {
        clauses.push(`tag:"${stripTagPrefix(tag)}"`)
    }

    // Freesound exposes the detected key as a single "tonality" descriptor of
    // the form "C# minor" rather than separate key / mode fields.
    if (params.key) {
        const mode = params.chord_type ?? "minor"
        clauses.push(`tonality:"${params.key} ${mode}"`)
    }

    if (params.bpm) {
        const bpm = parseFloat(params.bpm)
        if (!Number.isNaN(bpm)) clauses.push(`bpm:[${bpm} TO ${bpm}]`)
    } else if (params.min_bpm != null || params.max_bpm != null) {
        const min = params.min_bpm ?? 0
        const max = params.max_bpm ?? "*"
        clauses.push(`bpm:[${min} TO ${max}]`)
    }

    // Splice ships curated loop / one-shot slugs. Freesound has no equivalent
    // taxonomy, but it does tag sounds as loopable or as a single audio event.
    if (params.asset_category_slug == "loop") {
        clauses.push("loopable:true")
    } else if (params.asset_category_slug == "oneshot") {
        clauses.push("single_event:true")
    }

    return clauses.join(" ")
}

// ----------------------------------------------------------------- sorts

export type FreesoundSortParams = {
    sort: AssetSortType
    order: SortOrder
    bpm: string | null
}

/**
 * Translates Splicerr's sort state into a Freesound `sort` value.
 *
 * Freesound supports no ordering by filename or by key, and offers no random
 * ordering. Those cases fall back to relevance; "random" is additionally
 * shuffled page-locally by the caller.
 */
export function buildFreesoundSort(params: FreesoundSortParams): string {
    const desc = params.order == "DESC"

    switch (params.sort) {
        case "popularity":
            return desc ? "downloads_desc" : "downloads_asc"
        case "recency":
            return desc ? "created_desc" : "created_asc"
        case "duration":
            return desc ? "duration_desc" : "duration_asc"
        case "bpm": {
            const target = parseFloat(params.bpm ?? "")
            return `bpm:${Number.isNaN(target) ? 120 : target}`
        }
        case "name":
        case "key":
        case "random":
        case "relevance":
        default:
            return "score"
    }
}

export function freesoundSupportsSort(sort: AssetSortType) {
    return !["name", "key", "random"].includes(sort)
}

// ------------------------------------------------------------- normalizing

const tonalityToKey = (
    tonality: string | null
): { key: Key | null; chord_type: string | null } => {
    if (!tonality) return { key: null, chord_type: null }

    const [note, mode] = tonality.split(/\s+/)
    const key = FREESOUND_KEYS.find((k) => k.toLowerCase() == note?.toLowerCase())
    if (!key) return { key: null, chord_type: null }

    return { key: key as Key, chord_type: mode ?? null }
}

const packIdFromURI = (uri: string | null) => {
    if (!uri) return null
    const match = uri.match(/\/packs\/(\d+)\/?$/)
    return match ? match[1] : null
}

const guessCategory = (sound: FreesoundSound): AssetCategorySlug => {
    if (sound.loopable) return "loop"
    // Plenty of loops predate the loopable descriptor but are still tagged
    // as such by their uploaders.
    if (sound.tags.some((tag) => tag.includes("loop"))) return "loop"
    return "oneshot"
}

export function toSampleAsset(sound: FreesoundSound): SampleAsset {
    const { key, chord_type } = tonalityToKey(sound.tonality)
    const packId = packIdFromURI(sound.pack)
    const packName = sound.pack_name ?? sound.username

    // Freesound does not expose pack artwork, so we fall back to the sound's
    // own waveform render. It is always present and reads correctly at the
    // 12px size the pack preview uses.
    const packImage = sound.images?.waveform_m ?? ""

    const pack: PackAsset = {
        uuid: packId
            ? `freesound-pack-${packId}`
            : `freesound-user-${sound.username}`,
        name: packName,
        permalink_slug: packId ?? "",
        permalink_base_url: sound.username,
        url: packId
            ? `https://freesound.org/people/${encodeURIComponent(sound.username)}/packs/${packId}/`
            : `https://freesound.org/people/${encodeURIComponent(sound.username)}/`,
        files: [
            {
                uuid: `freesound-pack-image-${sound.id}`,
                path: "",
                asset_file_type_slug: "image",
                url: packImage,
                __typename: "AssetFile",
            },
        ],
        __typename: "PackAsset",
    }

    const files: AssetFile[] = [
        {
            uuid: `freesound-preview-${sound.id}`,
            name: sound.name,
            path: "",
            // Freesound previews are plain, unscrambled MP3s.
            asset_file_type_slug: "preview",
            url: sound.previews["preview-hq-mp3"],
            __typename: "AssetFile",
        },
        {
            uuid: `freesound-waveform-${sound.id}`,
            path: "",
            asset_file_type_slug: "waveform",
            url: sound.images?.waveform_m ?? "",
            __typename: "AssetFile",
        },
    ]

    const tags: AssetTag[] = (sound.tags ?? []).map((tag) => ({
        uuid: freesoundTagUUID(tag),
        label: tag,
        __typename: "AssetTag",
    }))

    return {
        source: "freesound",
        asset_type_slug: "sample",
        asset_prices: [
            { amount: 0, currency: "FS", __typename: "AssetPrice" },
        ],
        uuid: freesoundSoundUUID(sound.id),
        name: sound.name,
        tags,
        files,
        parents: { items: [pack], __typename: "AssetParentPage" },
        bpm: sound.bpm ?? undefined,
        key: key ?? undefined,
        chord_type: chord_type ?? undefined,
        duration: Math.round(sound.duration * 1000),
        asset_category_slug: guessCategory(sound),
        __typename: "SampleAsset",
    }
}

/**
 * Freesound has no tag facet endpoint, so we tally the tags of the page we
 * just received. Counts therefore describe the current page, not the whole
 * result set.
 */
export function deriveTagSummary(sounds: FreesoundSound[]): TagSummaryEntry[] {
    const counts = new Map<string, number>()

    for (const sound of sounds) {
        for (const tag of sound.tags ?? []) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_TAG_SUMMARY)
        .map(([label, count]) => ({
            count,
            tag: {
                uuid: freesoundTagUUID(label),
                label,
                taxonomy: {
                    uuid: "freesound-taxonomy",
                    name: "Instrument",
                    __typename: "TagTaxonomy",
                },
                __typename: "AssetTag",
            },
            __typename: "TagSummaryEntry",
        }))
}

// ---------------------------------------------------------------- search

export type FreesoundSearchParams = FreesoundFilterParams & {
    page: number
    page_size: number
    sort: AssetSortType
    order: SortOrder
}

export async function searchFreesound(params: FreesoundSearchParams) {
    if (!freesoundApiKey) {
        throw new Error(
            "No Freesound API key configured. Add one in Settings to search Freesound."
        )
    }

    const query = new URLSearchParams({
        query: params.query ?? "",
        fields: SEARCH_FIELDS.join(","),
        page: String(params.page),
        page_size: String(params.page_size),
        sort: buildFreesoundSort(params),
    })

    const filter = buildFreesoundFilter(params)
    if (filter) query.set("filter", filter)

    const startTime = Date.now()
    console.log("💌 Requesting Freesound", query.toString())

    const response = await fetch(`${FREESOUND_API_BASE}/search/?${query}`, {
        headers: { Authorization: `Token ${freesoundApiKey}` },
    })

    if (!response.ok) {
        const body = await response.text()
        console.error("Freesound search failed", response.status, body)
        throw new Error(
            response.status == 401
                ? "Freesound rejected the API key. Check it in Settings."
                : `Freesound search failed (${response.status})`
        )
    }

    const json = (await response.json()) as FreesoundSearchResponse
    console.log(
        "📬 Received",
        json.results.length,
        "Freesound sounds after",
        Date.now() - startTime,
        "ms"
    )

    return json
}
