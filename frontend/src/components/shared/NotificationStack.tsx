import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NotificationVariant = "success" | "warning" | "info" | "error";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  variant: NotificationVariant;
};

type NotificationStackProps = {
  notifications?: NotificationItem[];
};

const variantStyles: Record<
  NotificationVariant,
  {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    className: string;
  }
> = {
  success: {
    icon: CircleCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  warning: {
    icon: TriangleAlert,
    className: "border-amber-200 bg-amber-50 text-amber-700"
  },
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-700"
  },
  error: {
    icon: CircleX,
    className: "border-red-200 bg-red-50 text-red-700"
  }
};

export function NotificationStack({ notifications = [] }: NotificationStackProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-50 hidden w-72 flex-col gap-2 2xl:flex">
      {notifications.map((notification) => {
        const variant = variantStyles[notification.variant];
        const Icon = variant.icon;

        return (
          <div
            className={`rounded-md border bg-white p-3 shadow-sm ${variant.className}`}
            key={notification.id}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="text-xs">{notification.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
