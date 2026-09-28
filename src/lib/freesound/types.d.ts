// Subset of the Freesound APIv2 sound instance that Splicerr requests.
// See https://freesound.org/docs/api/resources_apiv2.html#sound-instance-response

export type FreesoundPreviews = {
    "preview-hq-mp3": string
    "preview-lq-mp3": string
    "preview-hq-ogg": string
    "preview-lq-ogg": string
}

export type FreesoundImages = {
    waveform_l: string
    waveform_m: string
    spectral_l: string
    spectral_m: string
}

export type FreesoundSound = {
    id: number
    name: string
    tags: string[]
    duration: number
    username: string
    license: string
    created: string
    num_downloads: number
    avg_rating: number
    previews: FreesoundPreviews
    images: FreesoundImages
    // API URI of the containing pack, null when the sound is not part of one
    pack: string | null
    // Undocumented but supported field, saves a request per result
    pack_name: string | null
    url: string
    // Content-based descriptors (Essentia). All optional, all may be null.
    note_name: string | null
    tonality: string | null
    bpm: number | null
    loopable: boolean | null
    single_event: boolean | null
}

export type FreesoundSearchResponse = {
    count: number
    next: string | null
    previous: string | null
    results: FreesoundSound[]
}
