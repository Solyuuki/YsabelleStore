const STAFF_LOGIN_PATH = "/staff-login";
const GUARDED_PASSWORD_SELECTOR = 'input[type="password"][autocomplete="current-password"]';

function clearControlledInputValue(input: HTMLInputElement) {
  if (!input.value) {
    return;
  }

  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(input, "");
  } else {
    input.value = "";
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Chrome can silently restore a stale saved password for localhost and pair it
 * with a remembered YsabelleStore account email. During local QA that makes a
 * valid account look broken even though the live backend accepts the correct
 * credentials.
 *
 * In development only, keep the internal staff password field read-only until
 * the user intentionally interacts with it. This prevents silent page-load
 * autofill while still allowing normal typing, paste, and explicit password-
 * manager selection after user interaction. Production login behavior is left
 * unchanged.
 */
export function installDevelopmentStaffLoginAutofillGuard() {
  if (!import.meta.env.DEV || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const guardedInputs = new WeakSet<HTMLInputElement>();

  const armVisibleStaffLoginPassword = () => {
    if (window.location.pathname !== STAFF_LOGIN_PATH) {
      return;
    }

    const passwordInputs = document.querySelectorAll<HTMLInputElement>(GUARDED_PASSWORD_SELECTOR);

    for (const input of passwordInputs) {
      if (guardedInputs.has(input)) {
        continue;
      }

      guardedInputs.add(input);
      input.form?.setAttribute("autocomplete", "off");
      input.setAttribute("autocomplete", "new-password");
      input.setAttribute("data-lpignore", "true");
      input.setAttribute("data-1p-ignore", "true");
      input.readOnly = true;

      // If the browser autofilled before the observer ran, remove that stale
      // value and synchronize React's controlled state back to empty.
      clearControlledInputValue(input);

      const unlockForIntentionalEntry = () => {
        input.readOnly = false;
        input.setAttribute("autocomplete", "off");
      };

      input.addEventListener("pointerdown", unlockForIntentionalEntry, {
        capture: true,
        once: true
      });
      input.addEventListener("keydown", unlockForIntentionalEntry, {
        capture: true,
        once: true
      });
      input.addEventListener("paste", unlockForIntentionalEntry, {
        capture: true,
        once: true
      });
    }
  };

  armVisibleStaffLoginPassword();

  const observer = new MutationObserver(armVisibleStaffLoginPassword);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("popstate", armVisibleStaffLoginPassword);
}
