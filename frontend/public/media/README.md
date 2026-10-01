# Store entrance media

The storefront entrance uses the approved original Gemini video byte-for-byte.

Canonical runtime path:

- `frontend/public/media/store-entrance.mp4`

Approved source fingerprint:

- size: `7,475,099` bytes
- SHA-256: `26c4d4b0d08395aa585a624e275cd57c07300923b5fa9fc06ca4292a34c40417`

Install the approved source without re-encoding:

```bash
npm run storefront:entrance:install
```

If the source is not in Downloads, pass its path explicitly:

```bash
npm run storefront:entrance:install -- "C:\\path\\to\\gemini_generated_video_418a3614.mp4"
```

Verify the installed file:

```bash
npm run storefront:entrance:verify
```

Runtime rules:

- the MP4 is never re-encoded, darkened, trimmed, or modified
- the permanent black shader/scrim is a CSS layer
- fade-to-black transitions are browser overlays
- JavaScript pauses before a Gemini dissolve, fades the curtain to black, seeks to the first clean frame after the dissolve, then resumes playback
- inspected dissolve windows are handled around `3.95→4.55s`, `5.72→6.28s`, and `9.22→9.65s`
- the end-to-start loop is controlled in-browser around `9.92→0.04s`
- the browser source URL is cache-busted with the approved SHA prefix
- playback is muted and inline with no video controls
- reduced-motion users receive the bundled static grocery poster

If the page shows the static poster during normal-motion testing, run `npm run storefront:entrance:verify`.
