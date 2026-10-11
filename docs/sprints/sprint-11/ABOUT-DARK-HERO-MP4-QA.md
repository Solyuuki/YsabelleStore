# Sprint 11 — About Scene 01 Dark Galaxy Hero

## Scope

Dark appearance now affects only the **first About story scene**. Its
`AboutWelcomeMotion` player selects the customer Storefront appearance
preference, not the internal retail preference. Other About scenes and the
approved Light Mode hero are deliberately preserved.

The Light Mode video `about-origin-motion-6738635d.mp4` still uses its
approved dual-video crossfade. The approved Gemini-generated Dark Mode
visual uses `about-dark-galaxy-loop.mp4` as a native, muted MP4 loop,
without a second crossfade competing with its mastered seam. The player
remounts when the customer changes appearance preference.

## Reviewed asset

- Output: `frontend/public/media/about-dark-galaxy-loop.mp4`
- Source: user-approved `gemini_generated_video_0597f8c6.mp4`
- Treatment: 2-second head/tail dissolve, recomposed into an 8-second cycle
- Format: H.264 yuv420p, 1280 x 720, no audio, MP4 fast-start
- Optimized file size: approximately 1.87 MB
- SHA256: `98a57e742f134f27e6c6d11c3cb5c2b7b29c8a3d504bba1d9cb910539438fe17`
- Seam frame comparison: 3.01 average absolute RGB levels for the
  newly looped video vs 10.60 for the original untrimmed master

### Binary publishing

The GitHub source-file connector can update UTF-8 files, but it cannot
transfer a binary from the chat sandbox to the repository. The approved,
processed MP4 is supplied in the separate
`about-dark-galaxy-hero-ready.zip` package, preserving the exact
`frontend/public/media` directory hierarchy.

To install on the developer's local Sprint 11 checkout: download the
approved ZIP into Windows Downloads, pull the latest branch, then run
`powershell -ExecutionPolicy Bypass -File scripts/install-about-dark-hero.ps1`
from the repository root. The installer verifies the exact SHA256.
No database updates or branch switches are performed.

**Release blocker:** The media file must be committed/published to the
same Sprint 11 branch separately before another checkout/deployment can
render the dynamic Dark Mode MP4. The dark CSS fallback works when the
binary is absent, but that is not equivalent to video QA acceptance.

## Manual acceptance

1. Open `/about` with customer Storefront Light selected: original
   pastel motion hero and original typography remain unchanged.
2. Select customer Dark while on `/about`: first hero switches to
   navy/violet galaxy video, with white/lavender readable title and support.
3. Let the video cycle for at least 60 seconds; verify no hard frame jump,
   bright flash, audio, or unexpected overlay animation.
4. Scroll into sections 2–4; they must retain their existing approved
   scene palette and scroll behavior. No cross-section global CSS inversion.
5. Toggle back to Light, refresh, and navigate away/back; preferences
   and proper hero source should be retained.
6. Check a laptop, ultrawide monitor, and mobile viewport. Centered
   typography must remain legible and motion should not stretch.
7. Enable reduced motion; hero uses a static dark gradient and
   does not autoplay the motion video.
8. Confirm in browser network panel that the dark MP4 returns HTTP 200,
   and that the original light MP4 is not loaded for a dark-only visit.

Automated source regression: `node --test scripts/test/about-dark-hero-motion.test.mjs`.
