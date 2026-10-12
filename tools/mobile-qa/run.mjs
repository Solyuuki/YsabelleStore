import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "screenshots");
const BASE_URL = process.env.MOBILE_QA_URL || "http://127.0.0.1:5174";
const VIEWPORTS = [
  { name: "small-phone", width: 320, height: 640 },
  { name: "android", width: 360, height: 800 },
  { name: "compact-iphone", width: 375, height: 812 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "phone-landscape", width: 640, height: 320 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 }
];

async function openBrowser() {
  try {
    // Reuse installed Chrome on the developer's PC; no separate browser download needed.
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      throw new Error(
        "Cannot launch Chrome/Chromium. Install Chrome or run: npm --prefix tools/mobile-qa exec playwright install chromium",
        { cause: error }
      );
    }
  }
}

async function measurePage(page, viewport) {
  return page.evaluate(({ width, height }) => {
    const selectors = [
      ".customer-header__bar",
      ".customer-mobile-dock",
      ".home-category-grid",
      ".home-category-card",
      ".home-product-rail__track",
      ".customer-product-card",
      ".customer-shop-layout",
      ".customer-shop-toolbar",
      ".shop-product-grid"
    ];
    const overflowing = [];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || !bounds.width) {
          continue;
        }
        if (bounds.left < -1 || bounds.right > width + 1) {
          overflowing.push({
            selector,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right)
          });
        }
      }
    }

    const dock = document.querySelector(".customer-mobile-dock");
    const dockVisible =
      dock &&
      getComputedStyle(dock).display !== "none" &&
      dock.getBoundingClientRect().height > 0;

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      dockVisible: Boolean(dockVisible),
      dockSlots: dockVisible ? dock.children.length : 0,
      legacyBurger: Boolean(document.querySelector(".customer-menu-button")),
      overflowing
    };
  }, viewport);
}

async function checkMorePanel(page, viewport) {
  const openButton = page.getByRole("button", { name: "Open more options" });
  await openButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  for (const label of ["About Us", "Customer Support", "Shopping Guide"]) {
    await dialog.getByText(label, { exact: true }).waitFor();
  }

  const rect = await dialog.boundingBox();
  if (!rect) throw new Error("More panel has no visible bounds");

  const issues = [];
  if (rect.x < 9 || rect.x + rect.width > viewport.width - 9) {
    issues.push("More panel exceeds horizontal phone margins");
  }
  if (rect.y < 8 || rect.y + rect.height > viewport.height - 8) {
    issues.push("More panel touches or clips the viewport edge");
  }
  if (viewport.width <= 700 && viewport.height > viewport.width) {
    const dockTop = await page.locator(".customer-mobile-dock").evaluate(
      (element) => element.getBoundingClientRect().top
    );
    if (rect.y + rect.height > dockTop - 6) {
      issues.push("More panel overlaps the bottom dock instead of floating above it");
    }
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-more.png`),
    animations: "disabled"
  });

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  return issues;
}

async function run() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const failures = [];
  const browser = await openBrowser();

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: viewport.width < 1180,
        hasTouch: viewport.width < 1180,
        reducedMotion: "reduce"
      });
      const page = await context.newPage();

      try {
        for (const route of ["/shop", "/"]) {
          const pageName = route === "/" ? "home" : "shop";
          const url = new URL(route, BASE_URL);
          await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20000 });

          if (route === "/") {
            // The Storefront entrance precedes CustomerLayout on a clean session.
            const start = page.getByText("Get Started", { exact: true });
            if (await start.count()) {
              await start.first().click();
            }
          }

          await page.locator(".customer-app").waitFor({ timeout: 15000 });
          await page.evaluate(() => document.fonts.ready);
          const dismiss = page.getByRole("button", { name: "Dismiss privacy notice" });
          if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

          const result = await measurePage(page, viewport);
          const issues = [];
          if (result.width !== viewport.width || result.height !== viewport.height) {
            issues.push("Unexpected viewport dimensions");
          }
          if (result.scrollWidth > viewport.width + 1) {
            issues.push(`Document overflow: ${result.scrollWidth}px > ${viewport.width}px`);
          }
          if (result.overflowing.length) {
            issues.push(`Elements outside viewport: ${JSON.stringify(result.overflowing.slice(0, 6))}`);
          }
          if (viewport.width <= 1180) {
            if (!result.dockVisible || result.dockSlots !== 5) {
              issues.push(`Expected 5 visible mobile nav slots, found ${result.dockSlots}`);
            }
          } else if (result.dockVisible) {
            issues.push("Mobile navbar is visible on desktop");
          }
          if (result.legacyBurger) issues.push("Legacy hamburger menu still rendered");

          await page.screenshot({
            path: join(OUTPUT_DIRECTORY, `${viewport.name}-${pageName}.png`),
            animations: "disabled",
            fullPage: false
          });

          if (route === "/shop" && viewport.width <= 1180) {
            issues.push(...(await checkMorePanel(page, viewport)));
          }
          if (issues.length) {
            failures.push({ viewport: viewport.name, route, issues });
          }
          process.stdout.write(
            `${issues.length ? "FAIL" : "PASS"} ${viewport.name} ${pageName}: ${issues.join("; ") || "width and navigation checks passed"}\n`
          );
        }
      } catch (error) {
        failures.push({ viewport: viewport.name, route: "runtime", issues: [String(error)] });
        process.stderr.write(`FAIL ${viewport.name}: ${error}\n`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.info(`Screenshots: ${OUTPUT_DIRECTORY}`);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.info("All automated mobile Storefront viewport checks passed.");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
