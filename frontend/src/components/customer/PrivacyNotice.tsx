import { Cookie, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { PRIVACY_NOTICE_VERSION, PRIVACY_STORAGE_ITEMS } from "@/content/privacy";

const PRIVACY_NOTICE_STORAGE_KEY = "ysabelle:privacy-notice-version";

function readNoticeDismissed() {
  try {
    return window.localStorage.getItem(PRIVACY_NOTICE_STORAGE_KEY) === PRIVACY_NOTICE_VERSION;
  } catch {
    return false;
  }
}

function rememberNoticeDismissed() {
  try {
    window.localStorage.setItem(PRIVACY_NOTICE_STORAGE_KEY, PRIVACY_NOTICE_VERSION);
  } catch {
    // The notice remains dismissible for this render even if browser storage is unavailable.
  }
}

export function PrivacyNotice({
  navigate,
  pathname
}: {
  navigate: (path: string) => void;
  pathname: string;
}) {
  const [visible, setVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setVisible(!readNoticeDismissed());
  }, []);

  function dismiss() {
    rememberNoticeDismissed();
    setVisible(false);
  }

  return (
    <>
      {visible && pathname !== "/privacy" ? (
        <aside aria-label="Privacy notice" className="customer-privacy-notice" role="region">
          <div className="customer-privacy-notice__texture" aria-hidden="true" />
          <div className="customer-privacy-notice__icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div className="customer-privacy-notice__copy">
            <p className="customer-privacy-notice__eyebrow">Privacy at Ysabelle Store</p>
            <strong>Service and security storage keeps requested store features working.</strong>
            <p>
              We use cookies and device storage for sign-in, verification, cart continuity,
              account security, recent searches, and similar requested store functions. The current
              storefront does not initialize advertising or behavioral analytics trackers.
            </p>
            <div className="customer-privacy-notice__links">
              <CustomerLink href="/privacy" navigate={navigate}>
                Privacy policy
                <ExternalLink aria-hidden="true" size={14} />
              </CustomerLink>
              <button onClick={() => setDetailsOpen(true)} type="button">
                Storage details
                <Cookie aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
          <button
            aria-label="Dismiss privacy notice"
            className="customer-privacy-notice__dismiss"
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </aside>
      ) : null}

      <Sheet onOpenChange={setDetailsOpen} open={detailsOpen}>
        <SheetContent className="customer-privacy-sheet">
          <SheetHeader className="customer-privacy-sheet__header">
            <div className="customer-privacy-sheet__mark" aria-hidden="true">
              <Cookie size={20} />
            </div>
            <SheetTitle>Cookies & device storage</SheetTitle>
            <SheetDescription>
              These are the storage mechanisms currently used by the customer storefront. They
              support requested features and security; they are not an advertising-consent list.
            </SheetDescription>
          </SheetHeader>

          <div className="customer-privacy-sheet__body">
            <div className="customer-privacy-sheet__status">
              <ShieldCheck aria-hidden="true" size={18} />
              <p>
                <strong>No advertising tracker is configured in the current storefront.</strong>
                If optional analytics or marketing technology is added later, this control must be
                updated before that technology is enabled.
              </p>
            </div>

            <div className="customer-privacy-storage-list">
              {PRIVACY_STORAGE_ITEMS.map((item) => (
                <article className="customer-privacy-storage-card" key={item.name}>
                  <div className="customer-privacy-storage-card__top">
                    <span>{item.category}</span>
                    <small>{item.technology}</small>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.purpose}</p>
                  <dl>
                    <div>
                      <dt>Duration</dt>
                      <dd>{item.duration}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>

          <div className="customer-privacy-sheet__footer">
            <Button
              onClick={() => {
                setDetailsOpen(false);
                navigate("/privacy#cookies-storage");
              }}
              type="button"
            >
              Read full privacy policy
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
