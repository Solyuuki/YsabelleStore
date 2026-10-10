import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

test("About first-section dark motion uses the customer preference, not the retail theme", () => {
  const experience = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const welcome = read("frontend/src/components/customer/about/AboutWelcomeMotion.tsx");
  const appearance = read("frontend/src/context/AppearanceContext.tsx");

  assert.match(experience, /const \{ storefrontTheme \} = useAppearance\(\)/);
  assert.equal((experience.match(/data-about-hero-theme=\{storefrontTheme\}/g) ?? []).length, 2);
  assert.match(welcome, /const \{ storefrontTheme \} = useAppearance\(\)/);
  assert.match(welcome, /isDark=\{storefrontTheme === "dark"\}/);
  assert.match(welcome, /key=\{storefrontTheme\}/);
  assert.match(appearance, /const preserveAbout = pathname === "\/about" \|\| pathname === "\/discover"/);
});

test("Dark galaxy MP4 is looped as a single muted player; approved light crossfade remains", () => {
  const welcome = read("frontend/src/components/customer/about/AboutWelcomeMotion.tsx");

  assert.match(welcome, /ABOUT_ORIGIN_VIDEO_FILE = "about-origin-motion-6738635d\.mp4"/);
  assert.match(welcome, /ABOUT_DARK_GALAXY_VIDEO_FILE = "about-dark-galaxy-loop\.mp4"/);
  assert.match(welcome, /const file = isDark \? ABOUT_DARK_GALAXY_VIDEO_FILE : ABOUT_ORIGIN_VIDEO_FILE/);
  assert.match(welcome, /key=\{storefrontTheme\}/);
  assert.match(welcome, /isDark \? \(\s*<video[\s\S]*?\bloop\b[\s\S]*?\bmuted\b/);
  assert.match(welcome, /\{\[0, 1\]\.map\(\(rawIndex\) =>/);
  assert.match(welcome, /if \(reduceMotion \|\| isDark \|\| !videoReady/);
  assert.match(welcome, /new URL\(`\.\/media\/\$\{file\}`, document\.baseURI\)/);
});

test("Only About scene one receives dark surface / typography rules", () => {
  const css = read("frontend/src/styles/about-welcome-motion.css");

  assert.match(css, /\.about-experience\[data-about-hero-theme="dark"\] \.discover-story--about \.story-welcome \{/);
  assert.match(css, /\.about-experience\[data-about-hero-theme="dark"\] \.about-welcome-motion__fallback \{/);
  assert.match(css, /\.about-experience\[data-about-hero-theme="dark"\][\s\S]*?\.story-welcome__title/);
  assert.match(css, /\.about-experience\[data-about-hero-theme="dark"\][\s\S]*?\.story-welcome__support p/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const scopedRules = css.slice(css.indexOf("/* About Scene 01 only"));
  assert.doesNotMatch(scopedRules, /\.story-(?:catalog|origin|forecast|delivery)(?:\s|\{|__)/);
});
