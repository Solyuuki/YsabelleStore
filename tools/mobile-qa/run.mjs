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
  { name: "tablet-landscape", width: 1024, height: 768 },
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
      doubleCircleFavorites: [],
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
        const innerCircle = getComputedStyle(favorite, "::before");
        const outerCircle = getComputedStyle(favorite, "::after");
        if (
          (innerCircle.display !== "none" && innerCircle.content !== "none") ||
          (outerCircle.display !== "none" && outerCircle.content !== "none")
        ) {
          productLayout.doubleCircleFavorites.push(index);
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

async function checkShopAvailability(page, viewport) {
  const issues = [];
  const trigger = page.getByRole("button", { name: /Availability:.*Choose filter/ });
  await trigger.click();
  const options = page.getByRole("group", { name: "Availability options" });
  await options.waitFor({ state: "visible" });
  const geometry = await options.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const buttons = [...node.querySelectorAll("button")];
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      dockTop: document.querySelector(".customer-mobile-dock")?.getBoundingClientRect().top ?? window.innerHeight,
      buttons: buttons.length,
      shortButtons: buttons.filter((button) => button.getBoundingClientRect().height < 43).length
    };
  });
  if (geometry.left < 8 || geometry.right > viewport.width - 8) {
    issues.push("Availability menu extends beyond the mobile viewport");
  }
  if (geometry.buttons !== 3 || geometry.shortButtons) {
    issues.push("Availability options are incomplete or too small to tap");
  }
  if (geometry.top < 0 || geometry.bottom > geometry.dockTop - 4) {
    issues.push("Availability menu is clipped by the screen edge or bottom dock");
  }
  const searchInput = page.locator(".customer-shop-search input");
  const inputSurface = await searchInput.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      image: style.backgroundImage,
      shadow: style.boxShadow
    };
  });
  if (
    !["transparent", "rgba(0, 0, 0, 0)"].includes(inputSurface.background) ||
    inputSurface.image !== "none" ||
    inputSurface.shadow !== "none"
  ) {
    issues.push("Search input has a separate rectangular background or shadow");
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-shop-availability.png`),
    animations: "disabled"
  });
  await options.getByRole("button", { name: "In stock" }).click();
  await page.waitForURL(/availability=in-stock/, { timeout: 10000 });
  if (await options.isVisible().catch(() => false)) {
    issues.push("Availability options did not close on selection");
  }
  await trigger.click();
  await options.waitFor({ state: "visible" });
  const checked = await options.getByRole("button", { name: "In stock" }).getAttribute("aria-pressed");
  if (checked !== "true") issues.push("Selected availability filter state did not persist");
  await page.keyboard.press("Escape");
  await options.waitFor({ state: "hidden", timeout: 2000 });
  return issues;
}

async function checkMobileAccountTabs(page, viewport) {
  // Compact navigation replaces the redundant Account rail on phones/tablets.
  // Use a layout fixture so no signed-in session or account mutation is needed.
  const state = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const fixture = document.createElement("section");
    fixture.className = "customer-account-page-v2";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;z-index:-1;";
    fixture.innerHTML = `
      <div class="customer-account-layout-v2">
        <aside class="customer-account-rail">
          <nav class="customer-account-nav" role="tablist" aria-label="Account views">
            <button type="button">Orders</button><button type="button">Favorites</button>
            <button type="button">Profile</button><button type="button">Security</button>
          </nav>
          <button class="customer-account-signout" type="button">Sign out</button>
        </aside>
        <main class="customer-account-content-v2"><section class="customer-account-section">Orders content</section></main>
      </div>`;
    app.appendChild(fixture);
    try {
      const rail = fixture.querySelector(".customer-account-rail");
      const content = fixture.querySelector(".customer-account-content-v2");
      const layout = fixture.querySelector(".customer-account-layout-v2");
      return {
        railDisplay: getComputedStyle(rail).display,
        contentDisplay: getComputedStyle(content).display,
        contentWidth: content.getBoundingClientRect().width,
        layoutWidth: layout.getBoundingClientRect().width
      };
    } finally {
      fixture.remove();
    }
  });

  if (!state) return ["Account layout fixture could not render"];
  if (
    state.railDisplay !== "none" ||
    state.contentDisplay === "none" ||
    state.contentWidth <= 0 ||
    state.contentWidth > state.layoutWidth + 2
  ) {
    return [`Account rail still occupies mobile space at ${viewport.width}px: ${JSON.stringify(state)}`];
  }
  return [];
}

async function checkFavoritesCardDensity(page, viewport) {
  // No signed-in customer needed: render sample card geometry using the real
  // Account styles. Product count, pagination and un-favorite use source tests.
  const state = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const fixture = document.createElement("section");
    fixture.className = "customer-account-page-v2";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;";
    fixture.innerHTML = `
      <div class="customer-account-layout-v2">
        <main class="customer-account-content-v2">
          <section id="favorites-panel" class="customer-account-section">
            <div class="customer-account-favorites-grid">
              ${Array.from({ length: 8 }, (_, index) => `
                <article class="customer-product-card">
                  <div class="customer-product-card__media">
                    <a class="customer-product-card__visual-link">
                      <div class="customer-product-visual"></div>
                    </a>
                  </div>
                  <div class="customer-product-card__body">
                    <p class="customer-eyebrow">Canned Goods</p>
                    <h3>Saved product ${index + 1}</h3>
                    <div class="customer-product-card__price-row">₱42.00</div>
                    <div class="customer-product-card__actions"></div>
                  </div>
                </article>`).join("")}
            </div>
          </section>
        </main>
      </div>`;
    app.appendChild(fixture);
    try {
      const grid = fixture.querySelector(".customer-account-favorites-grid");
      const cards = [...grid.querySelectorAll(".customer-product-card")];
      const gridRect = grid.getBoundingClientRect();
      const rects = cards.map((card) => card.getBoundingClientRect());
      const visuals = cards.map((card) =>
        card.querySelector(".customer-product-visual").getBoundingClientRect()
      );
      return {
        display: getComputedStyle(grid).display,
        columns: getComputedStyle(grid).gridTemplateColumns,
        width: gridRect.width,
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth,
        cardCount: cards.length,
        widths: rects.map((rect) => rect.width),
        images: visuals.map((rect) => ({ width: rect.width, height: rect.height })),
        clipped: rects.some((rect) => rect.left < gridRect.left - 1 || rect.right > gridRect.right + 1)
      };
    } finally {
      fixture.remove();
    }
  });
  if (!state) return ["Account favorites sizing fixture could not render"];
  const expectedColumns = viewport.width <= 640 ? 2 : viewport.width <= 1050 ? 3 : 4;
  const expectedCardMax = (state.width / expectedColumns) + 2;
  if (
    state.display !== "grid" ||
    state.cardCount !== 8 ||
    state.clipped ||
    state.scrollWidth > state.clientWidth + 2 ||
    state.widths.some((width) => width > expectedCardMax || width < 85) ||
    state.images.some((image) => image.height <= 0 || image.height > image.width * 0.81 + 1)
  ) {
    return [`Favorites cards are oversized or overflowing at ${viewport.width}px: ${JSON.stringify(state)}`];
  }
  return [];
}

async function checkActiveDeliveryDarkContrast(page, viewport) {
  // Theme probe for the actual Account > Orders styles. Never uses live
  // customer data, mutations, delivery confirmation or network requests.
  const metrics = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const fixture = document.createElement("section");
    // Match the actual Account page and account-content descendants; the
    // source rules target .customer-account-page-v2 #orders-panel, not Shop.
    fixture.className = "customer-account-page-v2 ys-glass-flow-background";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;left:0;top:0;max-width:100%;width:100%;visibility:hidden;pointer-events:none;";
    fixture.innerHTML = `
      <div class="customer-account-layout-v2">
        <main class="customer-account-content-v2">
          <section id="orders-panel" role="tabpanel" class="customer-account-section ys-material-surface">
        <article class="customer-account-order-v2 customer-account-order-v2--active">
          <div class="customer-account-order-topline">
            <div><span>DEL-YS-2026</span><strong>YS-2026-ORDER</strong></div>
            <span class="customer-delivery-status">Order placed</span>
          </div>
          <div class="customer-account-delivery-overview">
            <div><span>Payment</span><strong>Cash on Delivery</strong></div>
            <div><span>Total</span><strong>₱42.00</strong></div>
            <div><span>Ordered</span><strong>Oct 12, 2026</strong></div>
          </div>
          <div class="customer-account-delivery-address"><span>Pasig, Metro Manila</span></div>
          <div class="customer-delivery-progress">
            <ol class="customer-delivery-stepper">
              <li class="is-complete is-current">
                <div class="customer-delivery-stepper__track">
                  <span class="customer-delivery-stepper__marker">✓</span>
                </div>
                <div class="customer-delivery-stepper__copy">
                  <strong>Order placed</strong><small>Oct 12, 2026</small>
                </div>
              </li>
              <li>
                <div class="customer-delivery-stepper__track">
                  <span class="customer-delivery-stepper__marker">2</span>
                </div>
                <div class="customer-delivery-stepper__copy">
                  <strong>Preparing</strong><small>Pending</small>
                </div>
              </li>
            </ol>
          </div>
        </article>
      </section>
        </main>
      </div>`;
    app.appendChild(fixture);

    const parseRGB = (value) => {
      const matches = value.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
      return matches?.length === 3 ? matches : null;
    };
    const luminosity = (rgb) => {
      if (!rgb) return null;
      const parts = rgb.map((v) => {
        const srgb = v / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
    };
    const ratio = (ink, surface) => {
      const fg = luminosity(parseRGB(ink));
      const bg = luminosity(parseRGB(surface));
      if (fg == null || bg == null) return 0;
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    };
    const css = (selector) => getComputedStyle(fixture.querySelector(selector));
    const audit = () => {
      const panel = css(".customer-account-order-v2--active");
      const overview = css(".customer-account-delivery-overview > div");
      const checks = [
        [".customer-account-order-topline > div > span", panel.backgroundColor],
        [".customer-account-order-topline > div > strong", panel.backgroundColor],
        [".customer-account-order-topline > .customer-delivery-status",
          css(".customer-account-order-topline > .customer-delivery-status").backgroundColor],
        [".customer-account-delivery-overview > div > span", overview.backgroundColor],
        [".customer-account-delivery-overview > div > strong", overview.backgroundColor],
        [".customer-account-delivery-address", panel.backgroundColor],
        [".customer-delivery-stepper li.is-current .customer-delivery-stepper__copy strong",
          panel.backgroundColor],
        [".customer-delivery-stepper li:not(.is-complete) .customer-delivery-stepper__copy strong",
          panel.backgroundColor],
        [".customer-delivery-stepper li:not(.is-complete) .customer-delivery-stepper__copy small",
          panel.backgroundColor],
        [".customer-delivery-stepper li:not(.is-complete) .customer-delivery-stepper__marker",
          css(".customer-delivery-stepper li:not(.is-complete) .customer-delivery-stepper__marker").backgroundColor]
      ];
      const card = fixture.querySelector(".customer-account-order-v2--active");
      const progress = fixture.querySelector(".customer-delivery-progress");
      const stepper = fixture.querySelector(".customer-delivery-stepper");
      const darkSelector =
        ":root.dark .customer-app .customer-account-page-v2 #orders-panel .customer-account-order-v2--active";
      return {
        selectorMatches: !!card?.matches(darkSelector),
        documentDark: root.classList.contains("dark"),
        panelBackground: panel.backgroundColor,
        tileBackground: overview.backgroundColor,
        layout: {
          cardWidth: card?.clientWidth ?? 0,
          cardScrollWidth: card?.scrollWidth ?? 0,
          progressWidth: progress?.getBoundingClientRect().width ?? 0,
          stepperWidth: stepper?.getBoundingClientRect().width ?? 0,
          stepperDisplay: stepper ? getComputedStyle(stepper).display : "none"
        },
        checks: checks.map(([selector, background]) => ({
          selector,
          ratio: ratio(css(selector).color, background)
        }))
      };
    };
    try {
      root.classList.remove("dark");
      const light = audit();
      root.classList.add("dark");
      const dark = audit();
      return { light, dark };
    } finally {
      fixture.remove();
      root.classList.toggle("dark", wasDark);
    }
  });
  if (!metrics) return ["Delivery tracking dark account fixture could not render"];
  const issues = [];
  if (metrics.dark.panelBackground !== "rgb(34, 49, 73)" ||
      metrics.dark.tileBackground !== "rgb(43, 59, 85)" ||
      metrics.light.tileBackground === metrics.dark.tileBackground) {
    issues.push(
      "Delivery tracking dark summary tiles reverted to light-mode surfaces: " +
      JSON.stringify({
        selectorMatches: metrics.dark.selectorMatches,
        documentDark: metrics.dark.documentDark,
        lightPanel: metrics.light.panelBackground,
        darkPanel: metrics.dark.panelBackground,
        lightTile: metrics.light.tileBackground,
        darkTile: metrics.dark.tileBackground
      })
    );
  }
  if (viewport.width <= 720) {
    for (const theme of ["light", "dark"]) {
      const layout = metrics[theme].layout;
      if (
        layout.cardWidth <= 0 ||
        layout.cardScrollWidth > layout.cardWidth + 2 ||
        layout.stepperWidth > layout.progressWidth + 2 ||
        layout.stepperDisplay !== "grid"
      ) {
        issues.push(
          `Active delivery tracking overflows the phone viewport (${theme}, ${viewport.width}px): ${JSON.stringify(layout)}`
        );
      }
    }
  }
  // Existing light panels include gradient backgrounds. Sample their theme
  // change, but the targeted regression is the dark theme's solid surfaces.
  // A computed transparent color for a light gradient is not a contrast color.
  for (const check of metrics.dark.checks) {
    if (check.ratio < 4.5) {
      issues.push(
        `Delivery tracking order text contrast is insufficient (dark, ${check.selector}, ${viewport.width}px): ${check.ratio.toFixed(2)}:1`
      );
    }
  }
  return issues;
}

async function checkDeliveryTrackingContrast(page, viewport) {
  // Use a hidden Order Success tracking panel with the real loaded styles.
  // This never navigates to a paid order or touches customer records.
  const metrics = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const fixture = document.createElement("div");
    fixture.className = "customer-success-card";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;top:0;left:0;width:320px;max-width:100%;visibility:hidden;pointer-events:none;";
    fixture.innerHTML = `
      <div class="customer-success-pickup">
        <svg viewBox="0 0 24 24"></svg>
        <div>
          <strong>Delivery tracking starts here</strong>
          <span>Open My Account to follow Preparing, Ready for delivery, On the way, and Delivered.</span>
          <small>Courier booking is coordinated by store staff.</small>
        </div>
      </div>`;
    app.appendChild(fixture);

    const rgb = (color) => {
      const channels = color.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
      return channels?.length === 3 ? channels : null;
    };
    const luminance = (color) => {
      const c = rgb(color);
      if (!c) return null;
      const values = c.map((v) => {
        const srgb = v / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const sample = () => {
      const panel = fixture.querySelector(".customer-success-pickup");
      const background = getComputedStyle(panel).backgroundColor;
      const bg = luminance(background);
      const results = ["strong", "span", "small"].map((tag) => {
        const element = panel.querySelector(tag);
        const style = getComputedStyle(element);
        const fg = luminance(style.color);
        return {
          tag,
          color: style.color,
          fontSize: parseFloat(style.fontSize),
          contrast: fg === null || bg === null
            ? 0
            : (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
        };
      });
      return { background, results };
    };
    try {
      root.classList.remove("dark");
      const light = sample();
      root.classList.add("dark");
      const dark = sample();
      return { light, dark };
    } finally {
      fixture.remove();
      root.classList.toggle("dark", wasDark);
    }
  });

  if (!metrics) return ["Delivery tracking contrast fixture could not render"];
  const issues = [];
  for (const [theme, sample] of Object.entries(metrics)) {
    for (const text of sample.results) {
      const minimumSize = text.tag === "small" ? 11.5 : 12;
      if (text.contrast < 4.5 || text.fontSize < minimumSize) {
        issues.push(
          `Delivery tracking text contrast is insufficient (${theme}, ${text.tag}, ${viewport.width}px): ${text.contrast.toFixed(2)}:1 at ${text.fontSize}px`
        );
      }
    }
  }
  return issues;
}

async function checkCheckoutDarkBackground(page, viewport) {
  // Check the actual computed dark canvas without requiring a real customer
  // checkout session, creating an order, or changing the account's theme.
  const appearance = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;

    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const fixture = document.createElement("section");
    fixture.className = "customer-page customer-checkout-page";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;top:0;left:0;width:100%;min-height:1200px;visibility:hidden;pointer-events:none;z-index:-1;";

    try {
      root.classList.add("dark");
      app.appendChild(fixture);
      const dark = getComputedStyle(fixture);
      const background = {
        color: dark.backgroundColor,
        image: dark.backgroundImage,
        sizes: dark.backgroundSize.split(",").map((part) => part.trim()),
        repeat: dark.backgroundRepeat,
        position: dark.backgroundPosition
      };

      root.classList.remove("dark");
      const lightImage = getComputedStyle(fixture).backgroundImage;
      return { background, lightImage };
    } finally {
      fixture.remove();
      root.classList.toggle("dark", wasDark);
    }
  });

  if (!appearance) return ["Checkout dark background geometry could not be measured"];
  const { background, lightImage } = appearance;
  const issues = [];
  if (
    background.color !== "rgb(16, 24, 39)" ||
    background.image === "none" ||
    background.image.includes("ys-dark-midnight-velvet") ||
    !background.image.includes("linear-gradient") ||
    background.sizes.some((size) => size !== "auto") ||
    background.repeat.split(",").some((repeat) => repeat.trim() !== "no-repeat") ||
    lightImage === background.image
  ) {
    issues.push(
      `Checkout still uses a stretched or mismatched dark background at ${viewport.width}px: ${JSON.stringify(background)}`
    );
  }
  return issues;
}

async function checkCheckoutContentDensity(page, viewport) {
  // Measure responsive Checkout CSS with a hidden, realistic form fixture.
  // The suite can run as a guest: no checkout attempt or payment state changes.
  const metrics = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const fixture = document.createElement("div");
    fixture.className = "customer-checkout-page";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText =
      "position:absolute;left:0;top:0;width:100vw;visibility:hidden;pointer-events:none;z-index:-1;";
    fixture.innerHTML = `
      <div class="customer-container">
        <form class="customer-checkout-layout">
          <div class="customer-checkout-form">
            <section>
              <div class="customer-checkout-section-title">
                <span>1</span><div><h2>Your details</h2>
                <p>We prefilled your account details. You can edit them for this order.</p></div>
              </div>
              <div class="customer-form-grid">
                <label><span>Full name</span><input type="text" value="Ysabelle Store" /></label>
                <label><span>Mobile number</span><input type="tel" /></label>
                <label class="customer-form-grid__full">
                  <span>Email (optional)</span><input type="email" />
                </label>
              </div>
              <label class="customer-address-save-option">
                <input type="checkbox" /> <span>Save as my default delivery address</span>
              </label>
            </section>
            <section>
              <div class="customer-checkout-section-title">
                <span>3</span><div><h2>Payment method</h2>
                <p>Pay securely online now or pay in cash when your order arrives.</p></div>
              </div>
              <div class="customer-payment-options" role="radiogroup">
                <label class="customer-payment-option is-selected">
                  <input type="radio" checked name="test-pay" />
                  <svg viewBox="0 0 24 24"></svg>
                  <span><strong>PayMongo online payment</strong>
                    <small>Secure hosted test checkout. Pay before delivery.</small></span>
                  <svg viewBox="0 0 24 24"></svg>
                </label>
                <label class="customer-payment-option">
                  <input type="radio" name="test-pay" />
                  <svg viewBox="0 0 24 24"></svg>
                  <span><strong>Cash on Delivery</strong>
                    <small>Pay in cash when your order arrives.</small></span>
                </label>
              </div>
            </section>
          </div>
          <aside class="customer-order-summary customer-checkout-summary">
            <div class="customer-order-summary__heading"><h2>Final review</h2></div>
            <div class="customer-order-summary__row"><span>Delivery</span><strong>Store coordinated</strong></div>
            <div class="customer-order-summary__total"><span>Total</span><strong>₱250.00</strong></div>
          </aside>
        </form>
      </div>`;
    app.appendChild(fixture);
    try {
      const get = (selector) => fixture.querySelector(selector);
      const container = get(".customer-container");
      const section = get(".customer-checkout-form > section");
      const input = get(".customer-form-grid input[type=text]");
      const option = get(".customer-payment-option");
      const save = get(".customer-address-save-option");
      const summary = get(".customer-checkout-summary");
      if (![container, section, input, option, save, summary].every(Boolean)) return null;
      const containerBounds = container.getBoundingClientRect();
      const sectionBounds = section.getBoundingClientRect();
      const optionBounds = option.getBoundingClientRect();
      const summaryBounds = summary.getBoundingClientRect();
      const inputBounds = input.getBoundingClientRect();
      const padding = getComputedStyle(section);
      const width = window.innerWidth;
      const inContainer = (bounds) =>
        bounds.left >= containerBounds.left - 1 &&
        bounds.right <= containerBounds.right + 1;
      return {
        gutterLeft: containerBounds.left,
        gutterRight: width - containerBounds.right,
        sectionPadding: parseFloat(padding.paddingLeft),
        sectionWidth: sectionBounds.width,
        inputHeight: inputBounds.height,
        inputFontSize: parseFloat(getComputedStyle(input).fontSize),
        optionHeight: optionBounds.height,
        saveHeight: save.getBoundingClientRect().height,
        saveBorder: getComputedStyle(save).borderLeftWidth,
        sectionFits: inContainer(sectionBounds),
        optionFits: optionBounds.left >= sectionBounds.left - 1 &&
          optionBounds.right <= sectionBounds.right + 1,
        summaryFits: inContainer(summaryBounds),
        horizontalOverflow: fixture.scrollWidth > fixture.clientWidth + 2
      };
    } finally {
      fixture.remove();
    }
  });

  if (!metrics) return ["Checkout content density fixture did not render"];
  const issues = [];
  if (
    metrics.gutterLeft < 11 || metrics.gutterRight < 11 ||
    metrics.sectionPadding < 13 || metrics.sectionPadding > 18 ||
    metrics.sectionWidth < 270 ||
    metrics.inputHeight < 47 || metrics.inputFontSize < 16 ||
    metrics.optionHeight < 70 || metrics.saveHeight < 43 ||
    parseFloat(metrics.saveBorder) > 1 ||
    !metrics.sectionFits || !metrics.optionFits || !metrics.summaryFits ||
    metrics.horizontalOverflow
  ) {
    issues.push(
      `Checkout content remains cramped or overflows at ${viewport.width}px: ${JSON.stringify(metrics)}`
    );
  }
  return issues;
}

async function checkCheckoutPolicySpacing(page, viewport) {
  // This renders the actual checkout summary CSS in an isolated measurement
  // fixture. No authentication, cart mutation, or payment submission needed.
  const metrics = await page.evaluate(() => {
    const app = document.querySelector(".customer-app");
    if (!app) return null;
    const fixture = document.createElement("div");
    fixture.className = "customer-checkout-page";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText = "position:absolute;left:0;top:0;width:calc(100vw - 32px);visibility:hidden;pointer-events:none;z-index:-1;";
    fixture.innerHTML = `
      <aside class="customer-order-summary customer-checkout-summary">
        <div class="customer-checkout-policy-group">
          <p class="customer-order-summary__helper">Store staff will prepare your order and coordinate the courier. You can follow its delivery status from My Account.</p>
          <button class="customer-order-policy__trigger" type="button">Order cancellation policy</button>
        </div>
      </aside>`;
    app.appendChild(fixture);
    try {
      const group = fixture.querySelector(".customer-checkout-policy-group");
      const helper = fixture.querySelector(".customer-order-summary__helper");
      const button = fixture.querySelector(".customer-order-policy__trigger");
      if (!group || !helper || !button) return null;
      const groupStyle = getComputedStyle(group);
      const paragraphStyle = getComputedStyle(helper);
      const helperBounds = helper.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      const groupBounds = group.getBoundingClientRect();
      return {
        gap: buttonBounds.top - helperBounds.bottom,
        groupGap: groupStyle.rowGap,
        display: groupStyle.display,
        helperMarginBottom: paragraphStyle.marginBottom,
        buttonHeight: buttonBounds.height,
        buttonFits: buttonBounds.left >= groupBounds.left - 1 &&
          buttonBounds.right <= groupBounds.right + 1,
        paragraphFits: helperBounds.left >= groupBounds.left - 1 &&
          helperBounds.right <= groupBounds.right + 1
      };
    } finally {
      fixture.remove();
    }
  });
  if (!metrics) return ["Checkout policy spacing fixture could not render"];
  const issues = [];
  if (
    metrics.display !== "grid" ||
    metrics.gap < 14 ||
    metrics.gap > 22 ||
    metrics.buttonHeight < 43 ||
    !metrics.buttonFits ||
    !metrics.paragraphFits
  ) {
    issues.push(
      `Checkout delivery text and policy button gap is too small or clipped: ${metrics.gap.toFixed(1)}px at ${viewport.width}px`
    );
  }
  return issues;
}

async function checkMobileCart(page, viewport) {
  const issues = [];
  // Isolated browser context: only a guest cart in localStorage is touched;
  // no real checkout, paid order, or customer account state is mutated.
  const addButtons = page.locator(
    ".shop-product-grid-shell .customer-product-card__cart-button:not([disabled])"
  );
  await addButtons.first().waitFor({ state: "visible", timeout: 12000 });
  const available = await addButtons.count();
  if (available < 3) return ["Not enough in-stock products to verify a multi-item cart"];

  const itemsToAdd = available >= 6 ? 6 : 3;
  for (let index = 0; index < itemsToAdd; index += 1) {
    await addButtons.nth(index).click();
  }
  await page.goto(new URL("/cart", BASE_URL).href, { waitUntil: "domcontentloaded" });
  const cards = page.locator(".customer-cart-list .customer-cart-item");
  await cards.first().waitFor({ state: "visible", timeout: 15000 });

  const metrics = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".customer-cart-list .customer-cart-item")];
    return {
      count: cards.length,
      pageWidth: document.documentElement.scrollWidth,
      hasSummary: Boolean(document.querySelector(".customer-cart-summary-stack .customer-order-summary")),
      results: cards.map((card) => {
        const bounds = card.getBoundingClientRect();
        const image = card.querySelector(".customer-product-visual")?.getBoundingClientRect();
        const info = card.querySelector(".customer-cart-item__info")?.getBoundingClientRect();
        const actions = card.querySelector(".customer-cart-item__quantity")?.getBoundingClientRect();
        const remove = card.querySelector(".customer-cart-item__info button");
        const minus = card.querySelector(".customer-quantity button");
        const total = card.querySelector(".customer-cart-item__quantity > strong")?.getBoundingClientRect();
        const fits = (rect) =>
          !!rect &&
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1 &&
          rect.bottom <= bounds.bottom + 1;
        return {
          height: bounds.height,
          imageWidth: image?.width ?? 0,
          imageHeight: image?.height ?? 0,
          imageFits: fits(image),
          infoFits: fits(info),
          actionFits: fits(actions),
          totalFits: fits(total),
          controlsHeight: minus?.getBoundingClientRect().height ?? 0,
          removeHeight: remove?.getBoundingClientRect().height ?? 0,
          labeledRemove: remove?.getAttribute("aria-label")?.startsWith("Remove ") ?? false,
          contentOverflows: card.scrollWidth > card.clientWidth + 2
        };
      })
    };
  });

  const visibleCount = Math.min(itemsToAdd, 5);
  if (metrics.count !== visibleCount) {
    issues.push(`Expected ${visibleCount} cart lines, found ${metrics.count}`);
  }
  if (!metrics.hasSummary) issues.push("Order summary missing from multi-item cart");
  if (metrics.pageWidth > viewport.width + 1) issues.push("Multi-item cart overflows screen width");
  if (metrics.results.some((item) =>
    item.height > 235 ||
    item.imageWidth > 102 ||
    item.imageHeight > 102 ||
    !item.imageFits ||
    !item.infoFits ||
    !item.actionFits ||
    !item.totalFits ||
    item.controlsHeight < 43 ||
    item.removeHeight < 43 ||
    !item.labeledRemove ||
    item.contentOverflows
  )) {
    issues.push("Cart line is oversized, clipped, or has unusable actions");
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-cart.png`),
    animations: "disabled",
    fullPage: false
  });

  // When six products exist, pagination must keep five lines per page,
  // yet totals and item count must cover the complete basket.
  if (itemsToAdd === 6) {
    const pagination = page.getByRole("navigation", { name: "cart items pagination" });
    if (!(await pagination.isVisible())) {
      issues.push("Six distinct cart products did not show pagination");
    } else {
      await pagination.getByRole("button", { name: "Next page" }).click();
      if ((await cards.count()) !== 1) {
        issues.push("Cart second page did not show remaining product");
      }
      await pagination.getByRole("button", { name: "Previous page" }).click();
      if ((await cards.count()) !== 5) {
        issues.push("Cart pagination did not restore the first five products");
      }
    }
  }

  // Check quantity mutations too, when the first product has spare stock.
  const quantityInput = cards.first().locator(".customer-quantity input");
  const currentQuantity = Number(await quantityInput.inputValue());
  const increaseQuantity = cards.first().getByRole("button", {
    name: /Increase Quantity for/
  });
  if (!(await increaseQuantity.isDisabled())) {
    await increaseQuantity.click();
    if (Number(await quantityInput.inputValue()) !== currentQuantity + 1) {
      issues.push("Cart quantity control did not update selected quantity");
    }
  }

  // Cart operations must still work after the layout changes.
  const firstRemove = cards.first().getByRole("button", { name: /Remove .* from cart/ });
  await firstRemove.click();
  // Removing from a six-item basket pulls the sixth item onto page one,
  // so five rows should remain visible; three-item carts shrink to two.
  if ((await cards.count()) !== Math.min(itemsToAdd - 1, 5)) {
    issues.push("Remove cart item did not update list");
  }
  return issues;
}

async function checkMobileProductDetail(page, viewport) {
  const issues = [];
  const href = await page.locator(".customer-product-card__visual-link").first().getAttribute("href");
  if (!href) return ["No shop product link available for product detail QA"];
  await page.goto(new URL(href, BASE_URL).href, { waitUntil: "domcontentloaded", timeout: 20000 });
  const hero = page.locator(".customer-product-page .customer-product-visual--large");
  await hero.waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".customer-product-page .customer-review-filters").waitFor({
    state: "visible",
    timeout: 15000
  });

  const state = await page.evaluate(() => {
    const hero = document.querySelector(".customer-product-page .customer-product-visual--large");
    const rail = document.querySelector(".customer-product-page .customer-product-size-selector__options");
    const options = rail ? [...rail.querySelectorAll(".customer-product-size-option")] : [];
    const arrows = [...document.querySelectorAll(".customer-product-page .customer-product-size-selector__arrow")];
    const relatedRail = document.querySelector(".customer-product-page .customer-related-products__viewport");
    const relatedCards = relatedRail
      ? [...relatedRail.querySelectorAll(":scope > .customer-product-card")]
      : [];
    const relatedBounds = relatedRail?.getBoundingClientRect();
    const relatedCardBounds = relatedCards.map((card) => card.getBoundingClientRect());
    const relatedControls = [
      ...document.querySelectorAll(
        ".customer-product-page .customer-related-products__rail-shell > .customer-related-products__arrow"
      )
    ];
    const arrowBounds = relatedControls.map((button) => button.getBoundingClientRect());
    const relatedShell = document.querySelector(".customer-product-page .customer-related-products__rail-shell");
    const shellBounds = relatedShell?.getBoundingClientRect();
    const arrowLayout = {
      count: relatedControls.length,
      centered:
        relatedBounds && arrowBounds.length === 2
          ? Math.abs(
              (arrowBounds[0].left + arrowBounds[1].right) / 2 -
              (relatedBounds.left + relatedBounds.right) / 2
            ) < 3
          : true,
      belowCards:
        !relatedBounds ||
        arrowBounds.every((arrow) => arrow.top >= relatedBounds.bottom + 1),
      inShell:
        !!shellBounds &&
        arrowBounds.every(
          (arrow) =>
            arrow.left >= shellBounds.left - 1 &&
            arrow.right <= shellBounds.right + 1 &&
            arrow.bottom <= shellBounds.bottom + 1
        ),
      touchTargets: arrowBounds.every((arrow) => arrow.width >= 43 && arrow.height >= 43),
      staticPosition: relatedControls.every((button) => getComputedStyle(button).position === "static")
    };
    const relatedLayout = {
      arrowLayout,
      count: relatedCards.length,
      railWidth: relatedBounds?.width ?? 0,
      cardWidths: relatedCardBounds.map((rect) => rect.width),
      largestImageHeight: Math.max(
        0,
        ...relatedCards.map(
          (card) => card.querySelector(".customer-product-visual")?.getBoundingClientRect().height ?? 0
        )
      ),
      hasSnap: relatedRail ? getComputedStyle(relatedRail).scrollSnapType.includes("mandatory") : false,
      canSwipe: relatedRail
        ? relatedRail.scrollWidth > relatedRail.clientWidth + 2
        : false,
      cardOverflowsHeight: relatedCards.some((card) => card.scrollHeight > card.clientHeight + 2),
      countOfClippedActions: relatedCards.filter((card) => {
        const parent = card.getBoundingClientRect();
        const action = card.querySelector(".customer-product-card__cart-button")?.getBoundingClientRect();
        return action && (
          action.left < parent.left - 1 ||
          action.right > parent.right + 1 ||
          action.bottom > parent.bottom + 1
        );
      }).length
    };
    const visibleDocumentScrollbar = getComputedStyle(document.documentElement).scrollbarWidth;
    const reviewForm = document.querySelector(".customer-review-composer");
    const reviewFilters = document.querySelector(".customer-product-page .customer-review-filters");
    const reviewFilterButtons = reviewFilters ? [...reviewFilters.querySelectorAll("button")] : [];
    const filterBounds = reviewFilters?.getBoundingClientRect();
    const filterButtonBounds = reviewFilterButtons.map((button) => button.getBoundingClientRect());
    const filterRows = [...new Set(filterButtonBounds.map((rect) => Math.round(rect.top)))].length;
    const reviewFilterGeometry = {
      count: reviewFilterButtons.length,
      display: reviewFilters ? getComputedStyle(reviewFilters).display : "",
      rows: filterRows,
      horizontallyOverflowing:
        !reviewFilters ||
        reviewFilters.scrollWidth > reviewFilters.clientWidth + 2 ||
        filterButtonBounds.some(
          (rect) =>
            !filterBounds ||
            rect.left < filterBounds.left - 1 ||
            rect.right > filterBounds.right + 1
        ),
      shortTouchTargets: filterButtonBounds.filter((rect) => rect.height < 43).length
    };
    return {
      reviewFilterGeometry,
      relatedLayout,
      visibleDocumentScrollbar,
      heroHeight: hero?.getBoundingClientRect().height ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      railWidth: rail?.getBoundingClientRect().width ?? 0,
      overflowingVariantLabels: options.filter((element) => {
        const title = element.querySelector(".customer-product-size-option__copy");
        return title && title.scrollWidth > title.clientWidth + 2;
      }).length,
      hasLongTooltip: options.some((option) => option.hasAttribute("title")),
      variantImages: options.map((option) => {
        const visual = option.querySelector(".customer-product-size-option__visual");
        const image = option.querySelector(".customer-product-size-option__image > img");
        const frame = visual?.getBoundingClientRect();
        const imageBounds = image?.getBoundingClientRect();
        return {
          frameHeight: frame?.height ?? 0,
          imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
          fit: image ? getComputedStyle(image).objectFit : "",
          clipped:
            !!frame &&
            !!imageBounds &&
            imageBounds.width > 0 &&
            imageBounds.height > 0 &&
            (imageBounds.top < frame.top - 1 ||
              imageBounds.left < frame.left - 1 ||
              imageBounds.right > frame.right + 1 ||
              imageBounds.bottom > frame.bottom + 1)
        };
      }),
      visibleArrows: arrows.filter((arrow) => getComputedStyle(arrow).display !== "none").length,
      hasReviewForm: Boolean(reviewForm)
    };
  });

  // A product can have zero related recommendations in an empty fixture.
  // When at least two exist, they must form a two-up swipeable rail with
  // compact, fully-contained cards and reachable cart buttons.
  if (state.relatedLayout.count >= 2) {
    const maxExpectedWidth = (state.relatedLayout.railWidth - 8) / 2 + 2;
    if (
      state.relatedLayout.cardWidths.some((width) => width > maxExpectedWidth) ||
      state.relatedLayout.largestImageHeight > 205 ||
      !state.relatedLayout.hasSnap ||
      !state.relatedLayout.canSwipe ||
      state.relatedLayout.cardOverflowsHeight ||
      state.relatedLayout.countOfClippedActions
    ) {
      issues.push("Related-product carousel cards are oversized, clipped or not swipeable");
    }
    if (state.relatedLayout.arrowLayout.count === 2 && (
      !state.relatedLayout.arrowLayout.belowCards ||
      !state.relatedLayout.arrowLayout.inShell ||
      !state.relatedLayout.arrowLayout.centered ||
      !state.relatedLayout.arrowLayout.touchTargets ||
      !state.relatedLayout.arrowLayout.staticPosition
    )) {
      issues.push("Related-product arrows overlap cards or fall outside their navigation row");
    }
  }
  if (state.visibleDocumentScrollbar !== "none") {
    issues.push("Mobile storefront still shows a persistent document scrollbar");
  }

  if (state.heroHeight > 342 || state.heroHeight < 220) {
    issues.push(`Mobile detail image has incorrect height: ${Math.round(state.heroHeight)}px`);
  }
  if (state.scrollWidth > viewport.width + 1) {
    issues.push(`Product detail horizontal overflow: ${state.scrollWidth}px`);
  }
  if (state.hasLongTooltip || state.overflowingVariantLabels) {
    issues.push("Pack-size controls have obstructive tooltips or clipped labels");
  }
  if (
    state.variantImages.some(
      (image) => image.frameHeight < 99 || image.fit !== "contain" || image.clipped
    )
  ) {
    issues.push("Pack-size product thumbnails are clipped or too short for full images");
  }
  if (state.visibleArrows) {
    issues.push("Pack-size arrows still consume mobile rail width");
  }
  if (!state.hasReviewForm) {
    issues.push("Product detail review form is missing");
  }
  if (
    state.reviewFilterGeometry.count !== 6 ||
    state.reviewFilterGeometry.display !== "grid" ||
    state.reviewFilterGeometry.rows !== 2 ||
    state.reviewFilterGeometry.horizontallyOverflowing ||
    state.reviewFilterGeometry.shortTouchTargets
  ) {
    issues.push("Mobile rating filters do not fit the two-row, three-column touch grid");
  }

  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-product-detail.png`),
    animations: "disabled"
  });
  const fiveStars = page.getByRole("button", { name: /5-star reviews/ });
  const allReviews = page.getByRole("button", { name: /All reviews/ });
  await fiveStars.click();
  if ((await fiveStars.getAttribute("aria-pressed")) !== "true") {
    issues.push("5-star review filter did not become selected");
  }
  await allReviews.click();
  if ((await allReviews.getAttribute("aria-pressed")) !== "true") {
    issues.push("All review filter did not restore selection");
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

async function checkAboutMobileIntelligence(page, viewport) {
  // Exercise the actual About screens without changing operational data.
  await page.locator(".about-forecast-demo__chart-mobile").waitFor({
    state: "visible", timeout: 20000
  });
  const picker = page.locator(".system-preview__mobile-stage-picker select");
  await picker.waitFor({ state: "visible", timeout: 20000 });
  await page.locator(".story-delivery__frame").waitFor({ state: "attached", timeout: 20000 });

  const result = await page.evaluate(() => {
    const metrics = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        width: bounds.width,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        display: getComputedStyle(element).display
      };
    };
    return {
      chart: metrics(".about-forecast-demo__chart-mobile"),
      chartWrap: metrics(".about-forecast-demo__chart-wrap"),
      desktopChart: metrics(".about-forecast-demo__chart"),
      legacyStageRail: metrics(".system-preview__nav ol"),
      stagePicker: metrics(".system-preview__mobile-stage-picker"),
      deliveryStage: metrics(".story-delivery__stage"),
      deliveryFrame: metrics(".story-delivery__frame")
    };
  });
  const issues = [];
  if (
    !result.chart || result.chart.display === "none" ||
    !result.chartWrap || result.chartWrap.scrollWidth > result.chartWrap.clientWidth + 2 ||
    result.desktopChart?.display !== "none"
  ) {
    issues.push("Forecast phone chart hidden or horizontally scrollable");
  }
  if (
    result.legacyStageRail?.display !== "none" ||
    result.stagePicker?.display === "none"
  ) {
    issues.push("System Intelligence stage picker not replacing the 7-column rail");
  }
  if (
    !result.deliveryStage || !result.deliveryFrame ||
    result.deliveryStage.width > viewport.width + 1 ||
    result.deliveryFrame.width > result.deliveryStage.width + 2
  ) {
    issues.push("Delivery visual overflows the phone stage");
  }
  if ((await picker.locator("option").count()) !== 7) {
    issues.push("System Intelligence selector missing one or more stages");
  } else {
    await picker.selectOption("6");
    if ((await picker.inputValue()) !== "6") {
      issues.push("System Intelligence stage 7 cannot be selected");
    }
  }
  await page.screenshot({
    path: join(OUTPUT_DIRECTORY, `${viewport.name}-about-intelligence.png`),
    animations: "disabled",
    fullPage: false
  });
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

          // Physical phones cannot always be OS-locked from a browser tab.
          // On a small touch phone in landscape, verify the portrait-only
          // notice instead of treating the cramped storefront as supported.
          const orientationNotice = page.locator("#phone-orientation-notice");
          if (viewport.name === "phone-landscape") {
            const issues = [];
            await orientationNotice.waitFor({ state: "visible", timeout: 10000 });
            const notice = await orientationNotice.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                fixed: style.position === "fixed",
                width: rect.width,
                height: rect.height,
                title: element.textContent ?? ""
              };
            });
            if (
              !notice.fixed ||
              notice.width < viewport.width - 2 ||
              notice.height < viewport.height - 2 ||
              !notice.title.includes("Rotate your phone upright")
            ) {
              issues.push("Landscape phone did not show full-screen portrait orientation notice");
            }
            await page.screenshot({
              path: join(OUTPUT_DIRECTORY, `${viewport.name}-${pageName}.png`),
              animations: "disabled",
              fullPage: false
            });
            if (issues.length) failures.push({ viewport: viewport.name, route, issues });
            process.stdout.write(
              `${issues.length ? "FAIL" : "PASS"} ${viewport.name} ${pageName}: ${issues.join("; ") || "portrait notice visible"}\n`
            );
            continue;
          }
          if (await orientationNotice.isVisible()) {
            const message =
              viewport.name === "tablet" || viewport.name === "tablet-landscape"
                ? "Tablet orientation was incorrectly restricted"
                : "Portrait phone or desktop was incorrectly blocked by orientation notice";
            failures.push({ viewport: viewport.name, route, issues: [message] });
            process.stderr.write(`FAIL ${viewport.name} ${pageName}: ${message}\n`);
            continue;
          }

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
              ["Favorite button paints extra pseudo-element rings", layout.doubleCircleFavorites],
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

          if (route === "/shop") {
            issues.push(...(await checkFavoritesCardDensity(page, viewport)));
            issues.push(...(await checkCheckoutDarkBackground(page, viewport)));
            issues.push(...(await checkDeliveryTrackingContrast(page, viewport)));
            issues.push(...(await checkActiveDeliveryDarkContrast(page, viewport)));
          }
          if (route === "/shop" && viewport.width <= 640 && viewport.height > viewport.width) {
            issues.push(...(await checkMobileAccountTabs(page, viewport)));
          }
          if (route === "/shop" && viewport.width <= 430 && viewport.height > viewport.width) {
            issues.push(...(await checkCheckoutPolicySpacing(page, viewport)));
            issues.push(...(await checkCheckoutContentDensity(page, viewport)));
            issues.push(...(await checkShopCategories(page, viewport)));
            issues.push(...(await checkShopAvailability(page, viewport)));
          }
          if (route === "/shop" && viewport.width <= 1180) {
            issues.push(...(await checkMorePanel(page, viewport)));
          }
          if (route === "/" && viewport.width <= 700 && viewport.height > viewport.width) {
            issues.push(...(await checkCompactSearch(page, viewport)));
          }
          if (route === "/shop" && viewport.width <= 430 && viewport.height > viewport.width) {
            issues.push(...(await checkMobileProductDetail(page, viewport)));
            await page.goto(new URL("/shop?availability=in-stock", BASE_URL).href, {
              waitUntil: "domcontentloaded"
            });
            issues.push(...(await checkMobileCart(page, viewport)));
          }
          if (issues.length) {
            failures.push({ viewport: viewport.name, route, issues });
          }
          const status = issues.length ? "FAIL" : "PASS";
          const details = issues.join("; ") || "width and navigation checks passed";
          process.stdout.write(`${status} ${viewport.name} ${pageName}: ${details}\n`);
        }
        if (viewport.width <= 430 && viewport.height > viewport.width) {
          const aboutRoute = "/about";
          await page.goto(new URL(aboutRoute, BASE_URL).href, {
            waitUntil: "domcontentloaded",
            timeout: 20000
          });
          const aboutIssues = await checkAboutMobileIntelligence(page, viewport);
          if (aboutIssues.length) {
            failures.push({ viewport: viewport.name, route: aboutRoute, issues: aboutIssues });
          }
          process.stdout.write(
            `${aboutIssues.length ? "FAIL" : "PASS"} ${viewport.name} About: ${aboutIssues.join("; ") || "mobile intelligence fits"}\n`
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
