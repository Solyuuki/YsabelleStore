import type { PosSale } from "@/types/pos";

const peso = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const saleDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function SalesMobileReceiptDetails({ sale }: { sale: PosSale }) {
  return (
    <div className="ys-sales-mobile-receipt">
      <section aria-label="Receipt summary" className="ys-sales-mobile-receipt-summary">
        <p className="ys-sales-mobile-overline">Receipt</p>
        <h3 className="ys-sales-mobile-receipt-number">{sale.saleNumber}</h3>
        <p className="ys-sales-mobile-date">{saleDate.format(new Date(sale.saleDate))}</p>
        <div className="ys-sales-mobile-receipt-metadata">
          <span>Cashier: {sale.cashierName ?? "Unassigned cashier"}</span>
          <span>
            {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <section aria-label="Purchased items" className="ys-sales-mobile-items">
        <div className="ys-sales-mobile-items-heading">
          <h4>Purchased items</h4>
          <span>
            {sale.items.length} product{sale.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <ul className="ys-sales-mobile-item-list">
          {sale.items.map((item) => (
            <li className="ys-sales-mobile-item" key={item.id}>
              <div className="ys-sales-mobile-item-top">
                <div className="ys-sales-mobile-item-copy">
                  <p className="ys-sales-mobile-product-name">{item.productName}</p>
                  <p className="ys-sales-mobile-product-code">{item.barcode ?? item.sku}</p>
                </div>
                <strong className="ys-sales-mobile-item-amount">
                  {peso.format(Number(item.totalAmount))}
                </strong>
              </div>
              <div className="ys-sales-mobile-item-bottom">
                <span>
                  Qty {item.quantity} × {peso.format(Number(item.unitPrice))}
                </span>
                <span>{item.batchId ? "Batch linked" : "No batch link"}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Receipt totals" className="ys-sales-mobile-totals">
        <div>
          <span>Subtotal</span>
          <span>{peso.format(Number(sale.subtotalAmount))}</span>
        </div>
        <div>
          <span>Discount</span>
          <span>{peso.format(Number(sale.discountAmount))}</span>
        </div>
        <div className="ys-sales-mobile-grand-total">
          <strong>Total</strong>
          <strong>{peso.format(Number(sale.totalAmount))}</strong>
        </div>
      </section>
    </div>
  );
}
