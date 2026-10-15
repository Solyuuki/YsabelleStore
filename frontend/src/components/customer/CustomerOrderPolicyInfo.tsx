import { Info, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export function CustomerOrderPolicyInfo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="customer-order-policy__trigger" type="button">
          <Info aria-hidden="true" size={17} />
          <span>Order cancellation policy</span>
        </button>
      </DialogTrigger>

      <DialogContent className="customer-order-policy__dialog">
        <div className="customer-order-policy__header">
          <span aria-hidden="true" className="customer-order-policy__icon">
            <Info size={22} />
          </span>
          <div className="customer-order-policy__heading">
            <DialogTitle className="customer-order-policy__title">
              Before you place your order
            </DialogTitle>
            <DialogDescription className="customer-order-policy__description">
              Please review the store's cancellation policy.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              aria-label="Close order policy"
              className="customer-order-policy__close"
              type="button"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </DialogClose>
        </div>

        <div className="customer-order-policy__content">
          <p>You can review and change your cart until you submit the order.</p>
          <p lang="en">
            Once your order is placed, you cannot cancel it directly from My Account. You may
            contact the store to request a cancellation, subject to the order's preparation,
            delivery and payment status. Paid orders may need a separate refund process.
          </p>
        </div>

        <div className="customer-order-policy__footer">
          <DialogClose asChild>
            <button className="customer-order-policy__acknowledge" type="button">
              Understood
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
