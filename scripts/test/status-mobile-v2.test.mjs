import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL("../../"+path, import.meta.url),"utf8");
const css=read("frontend/src/styles/status-mobile-v2.css");
const main=read("frontend/src/main.tsx");
const screen=read("frontend/src/components/shared/StatusScreen.tsx");
const art=read("frontend/src/components/shared/StatusIllustration.tsx");
const stack=read("frontend/src/components/shared/NotificationStack.tsx");
const toast=read("frontend/src/components/shared/Toast.tsx");
const auth=read("frontend/src/components/shared/GlobalAuthenticationStatusScreen.tsx");
const reliability=read("frontend/src/components/shared/GlobalReliabilityUI.tsx");
const note=read("frontend/src/components/shared/GlobalHttpStatusNotifier.tsx");

test("All eight full-screen HTTP / reliability states share one scalable portal", () => {
  assert.match(main,/import "@\/styles\/status-mobile-v2\.css"/);
  assert.match(screen,/data-status-code=\{statusLabel\}/);
  assert.match(screen,/data-status-theme=\{statusTheme\}/);
  assert.match(screen,/createPortal\(screen, document\.body\)/);
  assert.equal((screen.match(/className="status-screen__content /g)||[]).length,3);
  for(const state of ["401","403","404","503","DATABASE","OFFLINE","SERVICE","TIMEOUT"]) {
    assert.match(art,new RegExp(state+":"+(state.match(/^\d+$/)?".*Illustration":".*Illustration")));
  }
  assert.match(auth,/statusLabel="401"/);
  assert.match(reliability,/statusLabel: "OFFLINE"/);
  assert.match(reliability,/statusLabel: "DATABASE"/);
  assert.match(reliability,/statusLabel: "TIMEOUT"/);
  assert.match(reliability,/statusLabel: lastHttpStatus === 503 \? "503" : "SERVICE"/);
});
test("Portrait mobile, short-screen, and tablet layouts keep headings and recovery buttons reachable",()=>{
  assert.match(css,/@media \(max-width: 1024px\)/);
  assert.match(css,/@media \(max-width: 359px\)/);
  assert.match(css,/@media \(max-width: 1024px\) and \(max-height: 680px\)/);
  assert.match(css,/\.status-screen\[data-status-screen\]\s*\{[^}]*height: 100dvh;[^}]*overflow-y: auto;/);
  assert.match(css,/\.status-screen \.status-screen__content\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/);
  assert.match(css,/\.status-screen \.status-illustration__image\s*\{[^}]*object-fit: contain;/);
  assert.match(css,/\.status-screen \.status-screen__title\s*\{[^}]*font-size: clamp/);
  assert.match(css,/\.status-screen \.status-screen__actions > button\s*\{[^}]*min-height: 44px;/);
  assert.match(css,/\.status-screen \.status-screen__note\s*\{[^}]*overflow-wrap: anywhere;/);
  assert.match(screen,/className="status-screen__actions /);
});
test("Status errors keep original sign-in, back and retry actions, keyboard focus and reduced motion",()=>{
  assert.match(auth,/label: "Sign in again"/);
  assert.match(reliability,/label: "Check connection"/);
  assert.match(screen,/role=\{critical \? "alertdialog" : "main"\}/);
  assert.match(screen,/aria-modal=\{critical \? true : undefined\}/);
  assert.match(screen,/content\.setAttribute\("inert", ""\)/);
  assert.match(screen,/containerRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
test("All global HTTP toasts fit narrow screens and dark mode without cutting off long errors",()=>{
  assert.match(stack,/ys-status-mobile-notifications/);
  assert.match(toast,/data-toast-variant=\{toast\.variant\}/);
  assert.match(toast,/ys-status-mobile-toast__message/);
  assert.match(toast,/ys-status-mobile-toast__dismiss/);
  assert.match(css,/\.ys-status-mobile-notifications\s*\{[^}]*max-height: min\(45dvh, 21rem\);[^}]*overflow-y: auto;/);
  assert.match(css,/\.ys-status-mobile-toast__copy\s*\{[^}]*overflow-wrap: anywhere;/);
  assert.match(css,/\.ys-status-mobile-toast__dismiss\s*\{[^}]*width: 40px;[^}]*height: 40px;/);
  assert.match(css,/:root\.dark \.ys-status-mobile-toast__message\s*\{[^}]*color: #ccd9ed;/);
  for(const status of [405,409,413,415,429,500,502,504]){
    assert.match(note,new RegExp(String(status)));
  }
});
test("Mobile reconnection banners use safe-area-aware wrapping without hiding retry controls",()=>{
  assert.match(css,/\.reliability-banner\s*\{[^}]*flex-wrap: wrap;/);
  assert.match(css,/\.reliability-banner__action\s*\{[^}]*min-height: 40px;/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
});
