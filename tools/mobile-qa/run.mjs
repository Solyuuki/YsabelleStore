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
        "Cannot launch Chrome/Chromium. Install Chrome or run: " +
          "npm --prefix tools/mobile-qa exec playwright install chromium",
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
    const portraitPhone = width <= 700 && height > width;
    const rails = [...document.querySelectorAll(".home-product-rail__viewport")];
    const horizontalRailsInPortrait = rails.filter((rail) => {
      return portraitPhone && rail.scrollWidth > rail.clientWidth + 2;
    }).length;

    // Cards outside the page viewport are expected inside a *clipped and
    // scrollable* Home product rail on landscape, tablet and desktop. They are
    // still checked on portrait phones, where rails must form vertical grids.
    function isContainedInHorizontalRail(element) {
      if (portraitPhone) return false;
      const rail = element.closest(".home-product-rail__viewport");
      if (!rail) return false;
      const railStyle = getComputedStyle(rail);
      const railBounds = rail.getBoundingClientRect();
      return (
        ["auto", "scroll"].includes(railStyle.overflowX) &&
        rail.scrollWidth > rail.clientWidth + 2 &&
        railBounds.left >= -1 &&
        railBounds.right <= width + 1
      );
    }

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || !bounds.width) {
          continue;
        }
        if (bounds.left < -1 || bounds.right > width + 1) {
          if (isContainedInHorizontalRail(element)) continue;
          overflowing.push({
            selector,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right)
          });
        }
      }
    }

    const categoryCards = [...document.querySelectorAll(".home-category-grid .home-category-card")];
    // Use untransformed layout heights. The entrance/reveal animation scales
    // cards as they enter view and is not a structural height mismatch.
    const cardHeights = categoryCards.map((card) => card.offsetHeight);
    const categoryImages = categoryCards.map((card) =>
      card.querySelector(".home-category-card__visual")?.offsetHeight ?? 0
    );
    const unevenHeights = (values) =>
      values.length > 1 && Math.max(...values) - Math.min(...values) > 2;
    const categoryLayout = {
      count: categoryCards.length,
      unevenCardHeights: unevenHeights(cardHeights),
      unevenImageHeights: unevenHeights(categoryImages),
      missingBrowsingActions: categoryCards.filter((card) => {
        const action = card.querySelector(".home-category-card__mobile-cta");
        return !action || getComputedStyle(action).display === "none";
      }).length,
      visibleDescriptions: categoryCards.filter((card) => {
        const description = card.querySelector(".home-category-card__description");
        return description && getComputedStyle(description).display !== "none";
      }).length
    };

    // Product density is a visual contract, not only document scroll width.
    // Inspect every rendered card at phone sizes, including cards below fold.
    const productCards = portraitPhone
      ? [...document.querySelectorAll(".customer-product-card")]
      : [];
    const productLayout = {
      count: productCards.length,
      badgeOverlaps: [],
      clippedBadges: [],
      smallFavoriteTargets: [],
      oversizedCartActions: [],
      smallQuantityTargets: [],
      visibleReviewCounts: [],
      wrongTitleClamps: []
    };
    productCards.forEach((card, index) => {
      const badge = card.querySelector(".customer-product-badge");
      const favorite = card.querySelector(".customer-product-card__favorite");
      const add = card.querySelector(".customer-product-card__cart-button");
      const quantityButtons = card.querySelectorAll(".customer-quantity > button");
      const title = card.querySelector("h3");
      const reviewCount = card.querySelector(".customer-product-card__review-count");
      const label = badge?.querySelector(".customer-product-badge__label-mobile");

      if (badge && favorite) {
        const badgeBounds = badge.getBoundingClientRect();
        const favoriteBounds = favorite.getBoundingClientRect();
        if (badgeBounds.right > favoriteBounds.left - 1) {
          productLayout.badgeOverlaps.push(index);
        }
        if (
          label &&
          (getComputedStyle(label).display === "none" ||
            label.scrollWidth > label.clientWidth + 1)
        ) {
          productLayout.clippedBadges.push(index);
        }
      }
      if (favorite) {
        const bounds = favorite.getBoundingClientRect();
        if (bounds.width < 43 || bounds.height < 43) {
          productLayout.smallFavoriteTargets.push(index);
        }
      }
      if (add && !add.disabled) {
        const bounds = add.getBoundingClientRect();
        if (bounds.width > 97 || bounds.height > 48 || bounds.height < 43) {
          productLayout.oversizedCartActions.push(index);
        }
      }
      if (
        [...quantityButtons].some((button) => {
          const bounds = button.getBoundingClientRect();
          return bounds.width < 24 || bounds.height < 43;
        })
      ) {
        productLayout.smallQuantityTargets.push(index);
      }
      if (reviewCount && getComputedStyle(reviewCount).display !== "none") {
        productLayout.visibleReviewCounts.push(index);
      }
      if (title && getComputedStyle(title).webkitLineClamp !== "2") {
        productLayout.wrongTitleClamps.push(index);
      }
    });

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
      categoryLayout,
      productLayout,
      horizontalRailsInPortrait,
      overflowing
    };
  }, viewport);
}

async function checkShopCategories(page, viewport) {
  const issues = [];
  const toggle = page.locator(".shop-category-toggle");
  await toggle.click();

  const menu = page.locator(".shop-category-navigation");
  const geometry = await menu.evaluate((element) => {
    const options = [...element.querySelectorAll(":scope > a")].filter(
      (link) => getComputedStyle(link).display !== "none"
    );
    const rows = options.map((link) => link.getBoundingClientRect());
    const columns = [...new Set(rows.map((rect) => Math.round(rect.left)))].length;
    const menuBounds = element.getBoundingClientRect();
    return {
      expanded: element.classList.contains("is-expanded"),
      optionCount: options.length,
      columns,
      maxHeight: menuBounds.height,
      horizontalOverflow: element.scrollWidth > element.clientWidth + 2,
      overflowingOptionLabels: options.filter((link) => {
        const label = link.querySelector("span");
        return label && label.scrollWidth > label.clientWidth + 2;
      }).length,
      smallOptions: rows.filter((rect) => rect.height < 43).length
    };
  });
  if (!geometry.expanded || geometry.optionCount < 2) {
    issues.push("Expanded category list does not show dynamic category choices");
  }
  if (viewport.width <= 430 && geometry.columns !== 1) {
    issues.push(`Narrow category picker stretched into ${geometry.columns} columns`);
  }
  if (geometry.maxHeight > Math.min(viewport.height * 0.48, 320) + 2) {
    issues.push("Expanded category panel takes too much vertical space");
  }
  if (geometry.horizontalOverflow || geometry.overflowingOptionLabels) {
    issues.push("Expanded category names or counts overflow horizontally");
  }
  if (geometry.smallOptions) {
    issues.push("Category options below 44px tap height");
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-shop-categories.png`),
    animations: "disabled"
  });
  await menu.locator(":scope > a").first().click();
  if ((await toggle.getAttribute("aria-expanded")) !== "false") {
    issues.push("Category picker did not collapse after choosing an option");
  }
  return issues;
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
      issues.push(
        `More panel overlaps dock: panelBottom=${Math.round(rect.y + rect.height)}, dockTop=${Math.round(dockTop)}`
      );
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

async function checkCompactSearch(page, viewport) {
  const issues = [];
  const header = page.locator(".customer-header");
  const headerBounds = await header.boundingBox();
  if (headerBounds && headerBounds.height > 110) {
    issues.push(`Mobile header uses excessive height: ${Math.round(headerBounds.height)}px`);
  }

  const region = page.locator(".customer-header__search-region");
  if (await region.isVisible()) {
    issues.push("Global search must be collapsed by default on mobile");
  }

  const trigger = page.getByRole("button", { name: "Open storefront search" });
  await trigger.click();
  await region.waitFor({ state: "visible" });
  const input = page.locator("#customer-global-search");
  await input.fill("555");

  const popup = page.locator(".customer-global-search__popup");
  await popup.waitFor({ state: "visible", timeout: 10000 });
  const popupBounds = await popup.boundingBox();
  const dockBounds = await page.locator(".customer-mobile-dock").boundingBox();
  if (!popupBounds) {
    issues.push("Mobile search suggestions are not visible");
  } else {
    if (popupBounds.height > 310) {
      issues.push(`Search suggestions too tall: ${Math.round(popupBounds.height)}px`);
    }
    if (popupBounds.x < -1 || popupBounds.x + popupBounds.width > viewport.width + 1) {
      issues.push("Search suggestions exceed the viewport width");
    }
    if (dockBounds && popupBounds.y + popupBounds.height > dockBounds.y - 6) {
      issues.push("Search suggestions cover the fixed bottom navigation");
    }
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-search.png`),
    animations: "disabled"
  });

  await page.keyboard.press("Escape");
  await region.waitFor({ state: "hidden" });
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
      // Visit the real Home layout rather than its first-visit Welcome screen.
      // This lives only in the isolated QA browser context, not the user's session.
      await context.addInitScript(() => {
        window.sessionStorage.setItem("ysabelle-store-entrance-entered", "true");
      });
      const page = await context.newPage();

      try {
        for (const route of ["/shop", "/"]) {
          const pageName = route === "/" ? "home" : "shop";
          const url = new URL(route, BASE_URL);
          await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20000 });

          // StoreEntrance shares .customer-app but has no navbar. The layout
          // class is the stable marker for actual Home and Shop content.
          await page.locator(".customer-app.ys-material-canvas").waitFor({ timeout: 15000 });
          await page
            .locator(route === "/" ? ".customer-home" : ".customer-shop-page")
            .waitFor({ timeout: 15000 });
          // Category-density assertions need actual loaded cards, not only the
          // Home shell. Missing catalog data must not silently pass UI QA.
          if (route === "/" && viewport.width <= 700 && viewport.height > viewport.width) {
            await page.locator(".home-category-grid .home-category-card").first().waitFor({
              state: "attached",
              timeout: 10000
            });
          }
          if (viewport.width <= 700 && viewport.height > viewport.width) {
            await page.locator(".customer-product-card").first().waitFor({
              state: "attached",
              timeout: 10000
            });
          }
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
          if (result.horizontalRailsInPortrait) {
            issues.push(`Horizontal product rails in portrait: ${result.horizontalRailsInPortrait}`);
          }
          if (route === "/" && viewport.width <= 700 && viewport.height > viewport.width) {
            if (result.categoryLayout.count < 2) {
              issues.push("Not enough category cards to verify two-column layout");
            }
            if (result.categoryLayout.unevenCardHeights) {
              issues.push("Category cards have inconsistent heights");
            }
            if (result.categoryLayout.unevenImageHeights) {
              issues.push("Category cover images have inconsistent heights");
            }
            if (result.categoryLayout.missingBrowsingActions) {
              issues.push("Category cards have missing mobile browsing actions");
            }
            if (result.categoryLayout.visibleDescriptions) {
              issues.push("Raw category descriptions remain visible in compact cards");
            }
          }
          if (viewport.width <= 700 && viewport.height > viewport.width) {
            const layout = result.productLayout;
            if (layout.count < 1) issues.push("No rendered product cards for density QA");
            for (const [issue, cardIndices] of [
              ["Overlapping product badge and favorite", layout.badgeOverlaps],
              ["Clipped or hidden mobile badge label", layout.clippedBadges],
              ["Favorite touch target below 44px", layout.smallFavoriteTargets],
              ["Cart action outside compact 44px sizing", layout.oversizedCartActions],
              ["Quantity controls below 24px wide or 44px tall", layout.smallQuantityTargets],
              ["Mobile review counts still visible", layout.visibleReviewCounts],
              ["Product titles not clamped to two lines", layout.wrongTitleClamps]
            ]) {
              if (cardIndices.length) {
                issues.push(`${issue}: cards ${cardIndices.slice(0, 6).join(", ")}`);
              }
            }
          }
          if (result.overflowing.length) {
            issues.push(
              `Elements outside viewport: ${JSON.stringify(result.overflowing.slice(0, 6))}`
            );
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

          if (route === "/shop" && viewport.width <= 430 && viewport.height > viewport.width) {
            issues.push(...(await checkShopCategories(page, viewport)));
          }
          if (route === "/shop" && viewport.width <= 1180) {
            issues.push(...(await checkMorePanel(page, viewport)));
          }
          if (route === "/" && viewport.width <= 700 && viewport.height > viewport.width) {
            issues.push(...(await checkCompactSearch(page, viewport)));
          }
          if (issues.length) {
            failures.push({ viewport: viewport.name, route, issues });
          }
          const status = issues.length ? "FAIL" : "PASS";
          const details = issues.join("; ") || "width and navigation checks passed";
          process.stdout.write(`${status} ${viewport.name} ${pageName}: ${details}\n`);
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
