import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { YsabelleBrandMark } from "./YsabelleBrandMark";

type BrandTargets = {
  liveStore: HTMLElement | null;
  welcome: HTMLElement | null;
};

const EMPTY_TARGETS: BrandTargets = { liveStore: null, welcome: null };

export function DiscoverBrandIdentity({ pathname }: { pathname: string }) {
  const [targets, setTargets] = useState<BrandTargets>(EMPTY_TARGETS);

  useLayoutEffect(() => {
    if (!["/about", "/discover"].includes(pathname)) {
      setTargets(EMPTY_TARGETS);
      return;
    }

    const welcome = document.querySelector<HTMLElement>(".story-welcome__mark");
    const liveStore = document.querySelector<HTMLElement>(
      ".story-live-store__bar > span:first-child"
    );

    welcome?.classList.add("story-welcome__mark--branded");
    liveStore?.classList.add("story-live-store__identity--branded");
    setTargets({ liveStore, welcome });

    return () => {
      welcome?.classList.remove("story-welcome__mark--branded");
      liveStore?.classList.remove("story-live-store__identity--branded");
    };
  }, [pathname]);

  return (
    <>
      {targets.welcome
        ? createPortal(<YsabelleBrandMark eager variant="display" />, targets.welcome)
        : null}
      {targets.liveStore
        ? createPortal(<YsabelleBrandMark variant="mini" />, targets.liveStore)
        : null}
    </>
  );
}
