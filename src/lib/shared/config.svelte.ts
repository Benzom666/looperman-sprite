import { appConfigDir, isAbsolute } from "@tauri-apps/api/path"
import type { SampleSource } from "$lib/splice/types"
import {
    exists,
    BaseDirectory,
    readTextFile,
    create,
    writeTextFile,
    mkdir,
    stat,
} from "@tauri-apps/plugin-fs"
import { resetMode, setMode } from "mode-watcher"
import { setFreesoundApiKey } from "$lib/freesound/api"

const CONFIG_FILE_NAME = "config.json"

export type UITheme = "system" | "light" | "dark"

const DEFAULT_CONFIG = {
    samples_dir: null as string | null,
    ui_theme: "system" as UITheme,
    ui_scale: 1,
    cut_mp3_delay: true,
    repeat_audio: true,
    active_source: "splice" as SampleSource,
    // Freesound read-only API key from https://freesound.org/apiv2/apply.
    // Stored in the app config dir, never in the repo.
    freesound_api_key: null as string | null,
    // False until the first-run setup has been completed.
    setup_complete: false,
}

let samplesDirValid = $state(false)

export let settingsDialog = $state({ open: false })

/**
 * Resolves once loadConfig() has finished. A child route's onMount runs before
 * the layout's, so anything that depends on the saved config (notably which
 * source to search) has to wait on this.
 */
let markConfigLoaded: () => void = () => {}
export const configLoaded = new Promise<void>((resolve) => {
    markConfigLoaded = resolve
})

export const isSamplesDirValid = () => samplesDirValid

export let config = $state<typeof DEFAULT_CONFIG>(
    JSON.parse(JSON.stringify(DEFAULT_CONFIG))
)

export async function validateSamplesDir() {
    async function validate() {
        if (!config.samples_dir) return false
        if (!(await isAbsolute(config.samples_dir))) return false
        if (!(await exists(config.samples_dir))) return false
        if (!(await stat(config.samples_dir)).isDirectory) return false
        return true
    }

    samplesDirValid = await validate()

    console.log(
        samplesDirValid
            ? "✅ Samples Directory valid"
            : "❌ Samples Directory invalid"
    )

    return samplesDirValid
}

export async function loadConfig() {
    if (
        !(await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig }))
    ) {
        console.log("📂 Config not found, keeping default")
    } else {
        const fileContent = await readTextFile("config.json", {
            baseDir: BaseDirectory.AppConfig,
        })
        Object.assign(config, JSON.parse(fileContent))

        // A hand-edited or outdated config could carry a source we do not know.
        if (!["splice", "freesound"].includes(config.active_source)) {
            console.warn("⚠️ Unknown active_source, falling back to splice")
            config.active_source = "splice"
        }

        console.log("📂 Config loaded")
    }

    setFreesoundApiKey(config.freesound_api_key)

    await validateSamplesDir()

    markConfigLoaded()
}

export async function saveConfig() {
    await validateSamplesDir()

    setFreesoundApiKey(config.freesound_api_key)

    const appConfig = await appConfigDir()
    if (!(await exists(appConfig))) await mkdir(appConfig)

    if (
        !(await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig }))
    ) {
        await create(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig })
    }

    await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(config), {
        baseDir: BaseDirectory.AppConfig,
    })
    console.log("💾 Config saved")
}

export function updateTheme() {
    switch (config.ui_theme) {
        case "system":
            resetMode()
            break
        default:
            setMode(config.ui_theme)
            break
    }
}
