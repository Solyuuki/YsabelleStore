import type { RetailReceiptData } from "@/types/receipt";
import type { PosSale } from "@/types/pos";

export function buildRetailReceiptDataFromSale(sale: PosSale): RetailReceiptData {
  return {
    cashReceived: sale.cashReceived,
    cashierName: sale.cashierName,
    change: sale.change,
    discountAmount: sale.discountAmount,
    itemCount: sale.itemCount,
    items: sale.items.map((item) => ({
      barcode: item.barcode,
      lineTotal: item.totalAmount,
      productName: item.productName,
      quantity: item.quantity,
      sku: item.sku,
      unitPrice: item.unitPrice
    })),
    paymentMethod: sale.paymentMethod,
    receiptNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    subtotal: sale.subtotalAmount,
    total: sale.totalAmount
  };
}
