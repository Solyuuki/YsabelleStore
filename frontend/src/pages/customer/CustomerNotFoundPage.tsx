import { Home, SearchX, ShoppingBag } from "lucide-react";

import { StatusScreen } from "@/components/shared/StatusScreen";

export function CustomerNotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <StatusScreen
      description="We couldn’t find this storefront page. It may have moved, or the address may be incorrect."
      eyebrow="Page not found"
      icon={SearchX}
      primaryAction={{
        icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
        label: "Go to the shop",
        onClick: () => navigate("/shop")
      }}
      secondaryAction={{
        icon: <Home className="h-4 w-4" aria-hidden="true" />,
        label: "Storefront home",
        onClick: () => navigate("/")
      }}
      statusLabel="404"
      title="This page isn’t here"
      variant="navigation"
    />
  );
}
