import { querySplice, SamplesSearch } from "$lib/splice/api"
import { descrambleSample } from "$lib/splice/descrambler"
import {
    deriveTagSummary,
    searchFreesound,
    toSampleAsset,
} from "$lib/freesound/api"
import {
    deriveLoopermanTagSummary,
    ensureLoopermanSession,
    fetchLoopermanPreview,
    fetchLoopermanWav,
    searchLooperman,
    toSampleAsset as toLoopermanAsset,
} from "$lib/looperman/api"
import type {
    AssetCategorySlug,
    AssetSortType,
    ChordType,
    Key,
    SampleAsset,
    SamplesSearchResponse,
    SampleSource,
    SortOrder,
    TagSummaryEntry,
} from "$lib/splice/types"
import { globalAudio } from "./audio.svelte"
import { loading } from "./loading.svelte"
import { config, saveConfig } from "./config.svelte"
import { isFreesound, isLooperman, shuffle } from "$lib/utils"
import { fetch } from "@tauri-apps/plugin-http"

export const DEFAULT_SORT = "relevance"
export const PER_PAGE = 50

export const randomSeed = () =>
    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()

export const dataStore = $state({
    sampleAssets: [] as SampleAsset[],
    descrambledSamples: new Map<string, string>(),
    tags: [] as string[],
    tag_summary: [] as TagSummaryEntry[],
    total_records: 0,
})

export const keys = [
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
] as const
export const chord_types = ["major", "minor"]

export const queryStore = $state({
    query: "",
    sort: DEFAULT_SORT as AssetSortType,
    random_seed: randomSeed(),
    order: "DESC" as SortOrder,
    page: 1,
    asset_category_slug: null as AssetCategorySlug | null,
    bpm: null as string | null,
    min_bpm: null as number | null,
    max_bpm: null as number | null,
    key: null as Key | null,
    chord_type: null as ChordType | null,
})

// The query identity is the part of the query that uniquely identifies the returned data
// It is used to determine if the fetched data should replace the current data, be appended to it, or be ignored
const queryIdentity = $derived({
    source: config.active_source,
    query: queryStore.query,
    sort: queryStore.sort,
    order: queryStore.order,
    random_seed: queryStore.random_seed,
    tags: dataStore.tags,
    asset_category_slug: queryStore.asset_category_slug,
    bpm: queryStore.bpm?.toString(),
    min_bpm: queryStore.min_bpm,
    max_bpm: queryStore.max_bpm,
    key: queryStore.key,
    chord_type: queryStore.chord_type,
})

export const storeCallbacks = $state({
    onbeforedataupdate: null as (() => void) | null,
    onbeforetagsupdate: null as (() => void) | null,
})

let currentQueryIdentity: string = ""
let fetchSeq = 0

// Both sources are normalized into this shape so that the pagination and
// stale-response bookkeeping below stays source agnostic.
type NormalizedPage = {
    items: SampleAsset[]
    total_records: number
    tag_summary: TagSummaryEntry[]
}

async function fetchSplicePage(): Promise<NormalizedPage | null> {
    const response = await querySplice(SamplesSearch, {
        ...queryIdentity,
        page: queryStore.page,
        limit: PER_PAGE,
    })

    if (!response) return null

    const searchResult = (response as SamplesSearchResponse).data.assetsSearch

    return {
        items: searchResult.items,
        total_records: searchResult.response_metadata.records,
        tag_summary: searchResult.tag_summary,
    }
}

async function fetchFreesoundPage(): Promise<NormalizedPage> {
    const response = await searchFreesound({
        query: queryStore.query,
        tags: dataStore.tags,
        key: queryStore.key,
        chord_type: queryStore.chord_type,
        bpm: queryStore.bpm,
        min_bpm: queryStore.min_bpm,
        max_bpm: queryStore.max_bpm,
        asset_category_slug: queryStore.asset_category_slug,
        page: queryStore.page,
        page_size: PER_PAGE,
        sort: queryStore.sort,
        order: queryStore.order,
    })

    const items = response.results.map(toSampleAsset)

    return {
        // Freesound cannot sort randomly, so we shuffle the page we received.
        items: queryStore.sort == "random" ? shuffle(items) : items,
        total_records: response.count,
        tag_summary: deriveTagSummary(response.results),
    }
}

async function fetchLoopermanPage(): Promise<NormalizedPage> {
    // An authenticated listing embeds per-loop WAV download tokens, so log
    // in first when credentials are configured. Search itself is public and
    // works without a session.
    await ensureLoopermanSession(
        config.looperman_email,
        config.looperman_password
    )

    const response = await searchLooperman({
        query: queryStore.query,
        tags: dataStore.tags,
        key: queryStore.key,
        chord_type: queryStore.chord_type,
        bpm: queryStore.bpm,
        min_bpm: queryStore.min_bpm,
        max_bpm: queryStore.max_bpm,
        asset_category_slug: queryStore.asset_category_slug,
        page: queryStore.page,
        page_size: PER_PAGE,
        sort: queryStore.sort,
        order: queryStore.order,
    })

    const items = response.items.map(toLoopermanAsset)

    return {
        // Looperman has no random ordering, so we shuffle the page received.
        items: queryStore.sort == "random" ? shuffle(items) : items,
        total_records: response.total,
        tag_summary: deriveLoopermanTagSummary(response.items),
    }
}

export const fetchAssets = () => {
    // Sequence numbers keep overlapping fetches honest: only the latest one
    // may settle the loading state, so a stale response can neither leave
    // the spinner stuck on nor overwrite a newer error.
    const seq = ++fetchSeq
    const identityBeforeFetch = JSON.stringify(queryIdentity)
    const pageBeforeFetch = queryStore.page
    if (identityBeforeFetch != currentQueryIdentity) {
        storeCallbacks.onbeforedataupdate?.()
    }
    loading.assets = true
    const page =
        config.active_source == "freesound"
            ? fetchFreesoundPage()
            : config.active_source == "looperman"
              ? fetchLoopermanPage()
              : fetchSplicePage()
    page
        .then((result) => {
            if (!result) {
                throw new Error("Received an empty response")
            }
            const searchResult = result
            const identityAfterFetch = JSON.stringify(queryIdentity)
            if (identityBeforeFetch == identityAfterFetch) {
                if (identityBeforeFetch == currentQueryIdentity) {
                    dataStore.sampleAssets.push(...searchResult.items)
                    console.info("➕ Loaded more assets")
                } else {
                    // Free descrambled samples that are not in the new search result / currently selected
                    for (const sampleAsset of dataStore.sampleAssets) {
                        if (
                            !searchResult.items.some(
                                (other) => sampleAsset.uuid == other.uuid
                            ) &&
                            sampleAsset.uuid != globalAudio.currentAsset?.uuid
                        ) {
                            freeDescrambledSample(sampleAsset.uuid)
                        }
                    }
                    // Prevent duplicates
                    dataStore.sampleAssets = searchResult.items.filter(
                        (asset) =>
                            !dataStore.sampleAssets.some(
                                (other) => other.uuid == asset.uuid
                            )
                    )
                    currentQueryIdentity = identityAfterFetch
                    queryStore.page = 1
                    console.info("🔄️ Loaded new assets")
                }
                dataStore.total_records = searchResult.total_records

                storeCallbacks.onbeforetagsupdate?.()
                dataStore.tag_summary = searchResult.tag_summary

                loading.assets = false
                loading.beforeFirstLoad = false

                loading.fetchError = null
            } else if (seq == fetchSeq) {
                // A stale response must still release the spinner when no
                // newer fetch is in flight, or infinite scroll stays blocked.
                loading.assets = false
                console.info("🕜 Ignored stale assets")
            } else {
                console.info("🕜 Ignored stale assets")
            }
        })
        .catch((error: Error) => {
            console.error("⚠️ Failed to fetch assets", error)
            if (seq != fetchSeq) return
            // A failed append must not consume its page, or the retry would
            // skip it and leave a gap in the list.
            if (JSON.stringify(queryIdentity) == identityBeforeFetch) {
                queryStore.page = pageBeforeFetch
            }
            loading.fetchError = error
            loading.assets = false
        })
}

/**
 * Switching sources invalidates everything currently loaded: the tag selection,
 * the cached descrambled blobs and whatever is playing all belong to the
 * source we are leaving.
 */
export function setActiveSource(source: SampleSource) {
    if (config.active_source == source) return

    console.info("🔀 Switching source to", source)

    config.active_source = source
    saveConfig()

    // Tag UUIDs are source-specific: Splice GUIDs mean nothing to Freesound's
    // tag index and vice versa, so a carried-over selection would silently
    // filter everything out.
    dataStore.tags.splice(0, dataStore.tags.length)
    dataStore.tag_summary = []
    dataStore.total_records = 0

    // Every cached blob belongs to the source we are leaving and the refetch
    // below will not revisit them, so release them now.
    for (const uuid of [...dataStore.descrambledSamples.keys()]) {
        freeDescrambledSample(uuid)
    }
    dataStore.sampleAssets = []
    queryStore.page = 1
    loading.beforeFirstLoad = true

    // Stop whatever is playing; it belongs to the source we just left.
    globalAudio.paused = true
    globalAudio.currentAsset = null
    globalAudio.currentTime = 0
    if (globalAudio.ref) globalAudio.ref.src = ""

    fetchAssets()
}

/**
 * Splice serves XOR-scrambled MP3s that must be descrambled into a blob before
 * they can be played. Freesound previews are already plain MP3s, so we hand the
 * URL straight to the audio element and skip the fetch entirely. Looperman
 * hotlink-protects its previews (403 without a looperman.com Referer, which the
 * app webview does not send), so we fetch the bytes through Tauri's HTTP
 * client into a blob URL instead.
 */
export async function getPreviewURL(sampleAsset: SampleAsset) {
    if (isFreesound(sampleAsset)) {
        return sampleAsset.files[0].url
    }
    if (isLooperman(sampleAsset)) {
        return await getLoopermanPreviewURL(sampleAsset)
    }
    return await getDescrambledSampleURL(sampleAsset)
}

export async function getLoopermanPreviewURL(sampleAsset: SampleAsset) {
    const existingBlobURL = dataStore.descrambledSamples.get(sampleAsset.uuid)
    if (existingBlobURL) {
        console.info("✔️ Reusing Looperman preview blob")
        return existingBlobURL
    }

    loading.samples.add(sampleAsset.uuid)
    loading.samplesCount++

    try {
        const blob = await fetchLoopermanPreview(sampleAsset.files[0].url)
        const blobURL = window.URL.createObjectURL(blob)
        dataStore.descrambledSamples.set(sampleAsset.uuid, blobURL)
        console.info("🔗 Created Looperman preview blob")
        return blobURL
    } finally {
        loading.samples.delete(sampleAsset.uuid)
        loading.samplesCount--
    }
}

export async function getDescrambledSampleURL(sampleAsset: SampleAsset) {
    const existingBlobURL = dataStore.descrambledSamples.get(sampleAsset.uuid)
    if (existingBlobURL) {
        console.info("✔️ Reusing descrambled sample blob")
        return existingBlobURL
    }

    loading.samples.add(sampleAsset.uuid)
    loading.samplesCount++

    const response = await fetch(sampleAsset.files[0].url)

    const data = new Uint8Array(await response.arrayBuffer())

    const descrambledData = descrambleSample(data)

    const blob = new Blob([descrambledData], {
        type: "audio/mp3",
    })

    const blobURL = window.URL.createObjectURL(blob)

    dataStore.descrambledSamples.set(sampleAsset.uuid, blobURL)

    loading.samples.delete(sampleAsset.uuid)
    loading.samplesCount--

    console.info("🔗 Created descrambled sample blob")

    return blobURL
}

/**
 * Raw audio bytes for saving to disk. Freesound originals are only reachable
 * through OAuth2, so with a read-only key we save its HQ MP3 preview instead.
 * Looperman originals are full-quality WAVs behind a login; we download via
 * the session-bound token scraped from the listing page and fall back to the
 * preview MP3 when the session or token expired.
 */
export async function getSampleAudioBlob(sampleAsset: SampleAsset) {
    if (isFreesound(sampleAsset)) {
        return await (await fetch(sampleAsset.files[0].url)).blob()
    }

    if (isLooperman(sampleAsset)) {
        const download = sampleAsset.files.find(
            (file) => file.asset_file_type_slug == "original"
        )
        if (download) {
            await ensureLoopermanSession(
                config.looperman_email,
                config.looperman_password
            )
            try {
                return await fetchLoopermanWav(
                    download.url,
                    sampleAsset.parents.items[0]?.url ??
                        "https://www.looperman.com/loops"
                )
            } catch (error) {
                console.warn(
                    "⚠️ Looperman WAV download failed, saving preview instead",
                    error
                )
            }
        }
        return await fetchLoopermanPreview(sampleAsset.files[0].url)
    }

    const blobURL = await getDescrambledSampleURL(sampleAsset)
    return await (await fetch(blobURL)).blob()
}

export function freeDescrambledSample(uuid: string) {
    const existingBlobURL = dataStore.descrambledSamples.get(uuid)
    if (!existingBlobURL) return false

    dataStore.descrambledSamples.delete(uuid)
    window.URL.revokeObjectURL(existingBlobURL)
    console.info("⛓️‍💥 Freed descrambled sample")

    return true
}
