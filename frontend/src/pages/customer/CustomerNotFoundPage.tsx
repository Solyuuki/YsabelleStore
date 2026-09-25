import { Home, SearchX, ShoppingBasket } from "lucide-react";

import { SystemStatusScreen } from "@/components/shared/SystemStatusScreen";

export function CustomerNotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <SystemStatusScreen
      code="404"
      eyebrow="Store navigation"
      icon={SearchX}
      message="This aisle does not exist, or the page has moved. Your cart and account data are unchanged."
      noteMessage="Return to the live catalog or the storefront home page to continue shopping."
      noteTitle="Nothing was lost"
      primaryAction={{
        icon: ShoppingBasket,
        label: "Go to the shop",
        onClick: () => navigate("/shop")
      }}
      secondaryAction={{
        icon: Home,
        label: "Store home",
        onClick: () => navigate("/"),
        variant: "secondary"
      }}
      statusMeta="HTTP 404 · storefront route not found"
      title="This aisle does not exist"
    />
  );
}
