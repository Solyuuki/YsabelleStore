import { CustomerLink } from "@/components/customer/CustomerLink";

export function CustomerNotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="customer-page customer-container">
      <div className="customer-empty-state">
        <p className="customer-kicker">404</p>
        <h1>This aisle does not exist.</h1>
        <p>Let&apos;s get you back to the groceries.</p>
        <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
          Go to the shop
        </CustomerLink>
      </div>
    </div>
  );
}
