# Installs the reviewed and loop-refined Gemini About dark hero locally.
# The binary lives in the separate downloadable QA package until published
# to frontend/public/media on the Sprint 11 GitHub branch.
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$archive = Join-Path $HOME "Downloads/about-dark-galaxy-hero-ready.zip"
$target = Join-Path $repoRoot "frontend/public/media/about-dark-galaxy-loop.mp4"
$expected = "98a57e742f134f27e6c6d11c3cb5c2b7b29c8a3d504bba1d9cb910539438fe17"

if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
  throw "Download about-dark-galaxy-hero-ready.zip into Downloads first: $archive"
}

Expand-Archive -LiteralPath $archive -DestinationPath $repoRoot -Force

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
  throw "Package did not contain the expected frontend/public/media path."
}

$actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  Remove-Item -LiteralPath $target -Force
  throw "Dark hero MP4 checksum mismatch. Re-download the approved asset."
}

Write-Host "About dark hero installed locally: $target"
Write-Host "SHA256 validated. Refresh /about and switch Storefront to Dark."
Write-Host "For deployment on other machines the MP4 must also be committed to the Sprint 11 branch."
