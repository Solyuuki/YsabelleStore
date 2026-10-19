import { Prisma, ProductVatCategory } from "@prisma/client";

// All selling prices are VAT inclusive. Round net VATable sales once per
// completed transaction so that VAT plus net exactly reconciles with gross.
export function calculatePosVatBreakdown(
  lines: Array<{ grossAmount: Prisma.Decimal; vatCategory: ProductVatCategory }>
) {
  const zero = new Prisma.Decimal(0);
  let vatableGross = zero;
  let vatExemptSalesAmount = zero;
  let zeroRatedSalesAmount = zero;

  for (const line of lines) {
    if (line.vatCategory === ProductVatCategory.UNCLASSIFIED) {
      throw new Error("VAT category approval is required for every POS item.");
    }
    if (line.grossAmount.lessThan(0)) {
      throw new Error("POS VAT cannot be computed from a negative line amount.");
    }
    if (line.vatCategory === ProductVatCategory.VATABLE) {
      vatableGross = vatableGross.add(line.grossAmount);
    } else if (line.vatCategory === ProductVatCategory.VAT_EXEMPT) {
      vatExemptSalesAmount = vatExemptSalesAmount.add(line.grossAmount);
    } else if (line.vatCategory === ProductVatCategory.ZERO_RATED) {
      zeroRatedSalesAmount = zeroRatedSalesAmount.add(line.grossAmount);
    }
  }

  const vatableSalesAmount = vatableGross.div("1.12").toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const vatAmount = vatableGross.sub(vatableSalesAmount);
  return { vatableSalesAmount, vatAmount, vatExemptSalesAmount, zeroRatedSalesAmount };
}
