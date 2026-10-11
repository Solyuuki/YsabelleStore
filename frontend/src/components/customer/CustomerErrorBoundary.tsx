import { Component, type ReactNode } from "react";

type CustomerErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type CustomerErrorBoundaryState = {
  failed: boolean;
};

export class CustomerErrorBoundary extends Component<
  CustomerErrorBoundaryProps,
  CustomerErrorBoundaryState
> {
  public override state: CustomerErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): CustomerErrorBoundaryState {
    return { failed: true };
  }

  public override componentDidCatch() {
    console.error("[customer-ui] render failure");
  }

  public override componentDidUpdate(previousProps: CustomerErrorBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  public override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="customer-runtime-fallback" role="alert">
        <div className="customer-runtime-fallback__card">
          <p className="customer-kicker">Storefront recovery</p>
          <h1>Something went wrong</h1>
          <p>We could not display this page correctly. Your account and cart data remain stored.</p>
          <button onClick={() => window.location.reload()} type="button">
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
