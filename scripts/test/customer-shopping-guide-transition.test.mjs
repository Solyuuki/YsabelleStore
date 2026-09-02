import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("cross-route guide uses an in-place content transition, not a loading screen", () => {
  const hook = read("frontend/src/hooks/useShoppingGuide.ts");
  const layout = read("frontend/src/layouts/CustomerLayout.tsx");
  const app = read("frontend/src/app/CustomerApp.tsx");
  const styles = read("frontend/src/styles/customer-guide-route-transition.css");

  assert.match(hook, /GUIDE_ROUTE_TRANSITION_CLASS\s*=\s*"ysabelle-guide-route-transition"/);
  assert.match(hook, /GUIDE_ROUTE_EXIT_MS\s*=\s*120/);
  assert.match(hook, /GUIDE_ROUTE_ENTER_MS\s*=\s*180/);
  assert.match(hook, /document\.documentElement\.classList\.add\(GUIDE_ROUTE_TRANSITION_CLASS\)/);
  assert.match(hook, /window\.setTimeout\(\(\) => navigate\("\/"\), GUIDE_ROUTE_EXIT_MS\)/);
  assert.match(hook, /waitForGuideTarget\(0, \(\) => \{/);
  assert.doesNotMatch(hook, /GUIDE_PREPARE_MIN|isPreparingGuide|useRef|useState/);

  assert.match(app, /@\/styles\/customer-guide-route-transition\.css/);
  assert.match(layout, /const \{ startGuide \} = useShoppingGuide/);
  assert.doesNotMatch(
    layout,
    /YsabelleBrandMark|customer-guide-transition|Preparing your shopping guide|Taking you to the storefront/
  );

  assert.match(styles, /\.customer-app > #customer-main/);
  assert.match(styles, /\.ysabelle-guide-route-transition #customer-main/);
  assert.match(styles, /opacity:\s*0\.38/);
  assert.match(styles, /filter:\s*blur\(1px\)/);
  assert.doesNotMatch(styles, /position:\s*fixed|inset:\s*0|customer-guide-progress/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ysabelle-guide-route-transition #customer-main[\s\S]*?transition:\s*none;/
  );
});
