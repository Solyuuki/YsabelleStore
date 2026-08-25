import type { AnchorHTMLAttributes, MouseEvent } from "react";

type CustomerLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  navigate: (path: string) => void;
};

export function CustomerLink({ href, navigate, onClick, ...props }: CustomerLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  }

  return <a href={href} onClick={handleClick} {...props} />;
}
