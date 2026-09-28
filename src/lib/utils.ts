import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ChordType, Key, SampleAsset, SampleSource } from "./splice/types"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Raw Splice GraphQL items carry no source marker, so treat them as Splice.
export const sampleSource = (sampleAsset: SampleAsset): SampleSource =>
    sampleAsset.source ?? "splice"

export const isFreesound = (sampleAsset: SampleAsset) =>
    sampleSource(sampleAsset) == "freesound"

export function shuffle<T>(items: T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

export const formatKey = (key: Key, chord_type: ChordType | null = null) => {
    return key.toUpperCase() + (chord_type ? ` ${chord_type.substring(0,3)}` : "")
}
