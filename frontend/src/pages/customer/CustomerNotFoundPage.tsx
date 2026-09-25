import { Home, SearchX, ShoppingBag } from "lucide-react";

import { StatusScreen } from "@/components/shared/StatusScreen";

export function CustomerNotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <StatusScreen
      description="This aisle does not exist. The page may have moved, or the address may be incorrect."
      eyebrow="Storefront navigation"
      icon={SearchX}
      noteDescription="Your cart and customer session remain unchanged. Choose a known storefront route to continue shopping."
      noteTitle="Your shopping state is preserved"
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
      statusLabel="HTTP 404"
      title="Page not found"
    />
  );
}
