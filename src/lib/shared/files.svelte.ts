import type { SampleAsset } from "$lib/splice/types"
import { join, sep } from "@tauri-apps/api/path"
import { exists, create, mkdir } from "@tauri-apps/plugin-fs"
import { fetch } from "@tauri-apps/plugin-http"
import { getSampleAudioBlob } from "./store.svelte"
import { config, isSamplesDirValid } from "$lib/shared/config.svelte"
import { isFreesound, isLooperman } from "$lib/utils"
import { encode } from "node-wav"
import { Buffer } from "buffer"

globalThis.Buffer = Buffer // node-wav needs Buffer which is not defined when using Vite

const sanitizePath = (path: string) => path.replace(/[^a-zA-Z0-9#_\-\.\/]/g, "_")

const AUDIO_EXTENSION =
    /\.(wav|wave|aif|aiff|flac|ogg|oga|mp3|m4a|aac|opus)$/i

// We always write 16-bit WAV, so a Freesound sound named "loop.aiff" must not
// end up as WAV bytes inside a file called "loop.aiff". Splice names are
// already extensionless, so its paths are left untouched. Looperman titles
// are human phrases, so they get the same treatment as Freesound names.
const wavFilename = (name: string) =>
    sanitizePath(name).replace(AUDIO_EXTENSION, "") + ".wav"

const sampleAssetPath = (sampleAsset: SampleAsset) =>
    sanitizePath(
        `${sampleAsset.parents.items[0].name}/${
            isFreesound(sampleAsset) || isLooperman(sampleAsset)
                ? wavFilename(sampleAsset.name)
                : sampleAsset.name
        }`
    )

async function ensureFileDirectoryExists(filePath: string) {
    const separator = sep()
    const dirs = filePath.split(separator).slice(0, -1) // Remove the filename
    let currentPath = ""

    for (const dir of dirs) {
        currentPath += dir + separator
        if (!(await exists(currentPath))) {
            await mkdir(currentPath)
        }
    }
}

export async function absoluteSamplePath(sampleAsset: SampleAsset) {
    if (!config.samples_dir) {
        throw new Error("❌ Samples Directory not set")
    }

    if (!isSamplesDirValid()) {
        throw new Error("❌ Samples Directory invalid")
    }

    return await join(config.samples_dir, sampleAssetPath(sampleAsset))
}

export async function saveSample(sampleAsset: SampleAsset) {
    const absolutePath = await absoluteSamplePath(sampleAsset)

    if (!absolutePath) {
        throw new Error("❌ Invalid path")
    }

    if (await exists(absolutePath)) {
        console.log("🗃️ Sample already exists at", absolutePath)
        return absolutePath
    }

    const blob = await getSampleAudioBlob(sampleAsset)

    const buffer = await blob.arrayBuffer()

    const samples = await new AudioContext().decodeAudioData(buffer)
    const channels: Float32Array[] = []

    // The 12ms trim corrects for MP3 encoder delay. Looperman WAV downloads
    // are already sample-accurate, so only trim compressed audio.
    const trimCompressed = config.cut_mp3_delay && blob.type != "audio/wav"

    for (let i = 0; i < samples.numberOfChannels; i++) {
        const channel = samples.getChannelData(i)
        
        // Calculate 12ms in samples based on the actual sample rate
        const trimSamples = trimCompressed ? Math.floor(samples.sampleRate * 0.012) : 0
        
        const start = trimSamples
        const end = (sampleAsset.duration / 1000) * samples.sampleRate + start
        
        // Make sure we don't try to slice beyond the available data
        const safeEnd = Math.min(end, channel.length)
        
        channels.push(channel.subarray(start, safeEnd))
    }

    const wavData = encode(channels as any, {
        bitDepth: 16,
        sampleRate: samples.sampleRate,
    })

    console.log("🏆 Sample converted! Saving at", absolutePath)

    await ensureFileDirectoryExists(absolutePath)

    const file = await create(absolutePath)
    await file.write(new Uint8Array(wavData))
    await file.close()

    console.log("🎉 Success!")

    return absolutePath
}

export async function absolutePackImagePath(sampleAsset: SampleAsset) {
    if (!config.samples_dir) {
        throw new Error("❌ Samples Directory not set")
    }

    if (!isSamplesDirValid()) {
        throw new Error("❌ Samples Directory invalid")
    }

    const pack = sampleAsset.parents.items[0]
    const packDir = sanitizePath(pack.name)
    // Freesound has no pack artwork and Looperman's stand-in is its waveform
    // render, so the saved cover is a PNG for both. Splice serves JPEGs.
    const extension =
        isFreesound(sampleAsset) || isLooperman(sampleAsset) ? "png" : "jpg"
    return await join(config.samples_dir, packDir, `cover.${extension}`)
}

export async function savePackImage(sampleAsset: SampleAsset) {
    const pack = sampleAsset.parents.items[0]
    const packImageUrl = pack?.files[0].url

    const absolutePath = await absolutePackImagePath(sampleAsset)

    if (!absolutePath) {
        throw new Error("❌ Invalid path")
    }

    if (await exists(absolutePath)) {
        console.log("🗃️ Image already exists at", absolutePath)
        return absolutePath
    }

    try {
        // Tauri's HTTP client rather than window.fetch, so that Freesound's CDN
        // does not need to send CORS headers.
        const response = await fetch(packImageUrl)
        if (!response.ok) throw new Error("Failed to fetch image")
        const buffer = await response.arrayBuffer()

        console.log("🖼️ Saving pack image at", absolutePath)

        await ensureFileDirectoryExists(absolutePath)

        const file = await create(absolutePath)
        await file.write(new Uint8Array(buffer))
        await file.close()

        console.log("🎉 Pack image saved!")

        return absolutePath
    } catch (e: any) {
        console.log(e.message)
        if (e instanceof TypeError && (e.message.includes("Failed to fetch") || e.message.includes("Load failed"))) {
            console.warn("⚠️ CORS error or network issue when fetching pack image", e)
            return null
        }
        throw e
    }
}

