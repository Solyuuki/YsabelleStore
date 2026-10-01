# Store entrance media

Use the original approved Gemini MP4 as the storefront entrance background.

Preferred local path:

- `frontend/public/media/gemini_generated_video_418a3614.mp4`

Legacy fallback path still supported by `StoreEntrance.tsx`:

- `frontend/public/media/store-entrance.mp4`

Runtime rules:

- do not re-encode, darken, trim, or bake transitions into the approved MP4
- the original video remains the source of truth
- the permanent black shader/scrim is a CSS layer in `customer-home-premium.css`
- short fade-to-black scene transitions are also browser layers; JavaScript pauses, seeks past the Gemini dissolve, then resumes playback
- the known dissolve windows are handled around 4.0s, 5.74s, and 9.2s
- the end-to-start loop is controlled in-browser instead of using the native `loop` attribute
- no video controls are shown
- playback is muted and inline
- reduced-motion users receive the bundled static grocery fallback

The video file itself should stay clean and unchanged.
