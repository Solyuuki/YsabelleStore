# Store entrance media

The storefront entrance uses the approved final Gemini MP4 without modifying its bytes.

Canonical runtime video:

- `frontend/public/media/store-entrance.mp4`

Entrance logo:

- `StoreEntrance.tsx` reuses the same `YsabelleBrandMark` component used by the customer header.
- This intentionally removes the separate entrance-logo asset path and its failure mode.

## Runtime behavior

The video now uses normal browser autoplay + muted + inline + native loop playback.

There is no scene fade compositor, no pause choreography, no seeking, and no re-encoding. The source MP4 plays exactly as generated.

The approved dark shader/scrim and the light 1.2px presentation blur remain separate CSS layers in `customer-home-premium.css`. Neither is baked into the video.

The only remaining transition is the page-exit fade when the customer clicks **Get Started**.

## Asset verification

Verify the approved video:

```bash
npm run storefront:entrance:verify
```

Reduced-motion users receive the static grocery fallback instead of autoplay video.

Approved source:

- `gemini_generated_video_9a2cd402.mp4`
- Size: `5,417,920` bytes
- SHA256: `53360d489f4303761658cc62cc5984f4ea43116b470ae7e63d263c48497e4df3`

## About origin motion

The first About story scene uses the approved Gemini MP4 as a decorative motion plate while all logo and story typography remain responsive HTML.

Canonical runtime video:

- `frontend/public/media/about-origin-motion.mp4`

Approved source:

- `gemini_generated_video_4013f49c.mp4`
- Size: `2,554,527` bytes
- SHA256: `6738635db4cf22b744aba5ced30bc4a9533245e0f02352df406381d21487dad9`

Install the source from the repository root:

```bash
npm run storefront:about-origin:install
```

The installer searches the repository root, `frontend/public/media`, Downloads, and Desktop for the approved Gemini filename. An explicit source path can also be supplied:

```bash
npm run storefront:about-origin:install -- "C:\\path\\to\\gemini_generated_video_4013f49c.mp4"
```

Verify the installed runtime asset:

```bash
npm run storefront:about-origin:verify
```

Runtime behavior:

- The approved source is copied byte-for-byte. It is not re-encoded, trimmed, recolored, or otherwise modified.
- The video is muted in the browser and starts only while the About hero intersects the viewport.
- Playback pauses when the hero leaves the viewport or the document becomes hidden.
- A lightweight animated CSS plate remains behind the video and is used if the media is missing, still loading, autoplay is unavailable, or reduced motion is requested.
- Shader/scrim, responsive typography, and scroll transitions remain separate CSS/GSAP layers.

