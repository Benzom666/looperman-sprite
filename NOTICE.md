# Notices

## This project

**Sprite** is a derivative work. It began as a fork of
[Splicerr](https://github.com/Robert-K/splicerr) by Kosro (Robert-K), which is
itself a rewrite of [Splicedd](https://github.com/ascpixi/splicedd) by
ascpixi.

All three remain MIT licensed. See [LICENSE](LICENSE).

What Sprite changes relative to Splicerr:

- Renamed from Splicerr to Sprite, with a new bundle identifier.
- **Freesound** added as a first-class sample source alongside Splice, including
  a guided first-run setup and live API-key validation.
- Interface redesign: left filter rail, IBM Plex type, a new palette, and a
  level-meter signature element.
- A latent crash in the Splice search-autocomplete path was fixed, as was a
  config-load race that made the first search always run before settings loaded.
- Two Splice patches that upstream carried (MPEG Layer I audio, a stray
  "modular" preset) were removed during development.

## Bundled assets

- **IBM Plex Sans** and **IBM Plex Mono**, SIL Open Font License 1.1,
  Copyright IBM Corp. Self-hosted; no network requests are made at runtime.
- `flashbang.mp3`, Lucide icons (ISC), Svelte and Tauri logos — all from the
  upstream Splicerr project under the same MIT terms.

## Audio

Sprite does not host any audio. It indexes and previews:

- **Freesound** samples, which remain under their own individual Creative
  Commons licenses. Check each sound's license on Freesound before using it in
  a release.
- **Splice** samples, fetched from your existing Splice catalogue access.

Sprite converts previews to 16-bit WAV when you drag a sound into your DAW.
Those files are derived works of the original samples; the original licenses
still apply.
