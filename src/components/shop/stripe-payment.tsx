import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";


const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string) {
  let promise = stripeCache.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripeCache.set(publishableKey, promise);
  }
  return promise;
}

type Props = {
  publishableKey: string;
  clientSecret: string;
  returnUrl: string;
  amountLabel: string;
  onPaid: () => void | Promise<void>;
};

/** Stripe Payment Element inkl. Apple Pay / Google Pay (geräteabhängig). */
export function StripePaymentSection(props: Props) {
  const stripePromise = useMemo(() => getStripe(props.publishableKey), [props.publishableKey]);
  const isTestMode = props.publishableKey.startsWith("pk_test_");
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: { theme: "night", variables: { colorPrimary: "#f59e0b", borderRadius: "12px" } },
      }}
    >
      <PaymentForm {...props} isTestMode={isTestMode} />
    </Elements>
  );
}

function PaymentForm({ returnUrl, amountLabel, onPaid }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Apple Pay / Google Pay / Link – nur anzeigen, wenn der Browser sie anbietet.
  const [expressAvailable, setExpressAvailable] = useState(false);

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className={expressAvailable ? "space-y-3" : "hidden"}>
        <ExpressCheckoutElement
          options={{ buttonTheme: { applePay: "black", googlePay: "black" } }}
          onReady={(event) => {
            setExpressAvailable(Object.keys(event.availablePaymentMethods ?? {}).length > 0);
          }}
          onConfirm={async () => {
            // Gleicher PaymentIntent / Elements-Kontext – keine neue Reservierung.
            if (!stripe || !elements || busy) return;
            setBusy(true);
            setError(null);
            const result = await stripe.confirmPayment({
              elements,
              confirmParams: { return_url: returnUrl },
              redirect: "if_required",
            });
            if (result.error) {
              setError(result.error.message ?? "Die Zahlung wurde nicht abgeschlossen.");
              setBusy(false);
              return;
            }
            await onPaid();
            setBusy(false);
          }}
        />
        <p className="text-center text-xs text-muted-foreground">oder mit Karte bezahlen</p>
      </div>
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      <Button
        size="lg"
        disabled={!stripe || !elements || busy}
        aria-busy={busy}
        className="h-14 w-full rounded-xl bg-flame text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
        onClick={async () => {
          if (!stripe || !elements || busy) return;
          setBusy(true);
          setError(null);
          const result = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: "if_required",
          });
          if (result.error) {
            setError(result.error.message ?? "Die Zahlung wurde nicht abgeschlossen.");
            setBusy(false);
            return;
          }
          await onPaid();
          setBusy(false);
        }}
      >
        {busy ? "Zahlung läuft …" : `${amountLabel} bezahlen`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Stripe-Testmodus – es wird kein echtes Geld bewegt.
      </p>
    </div>
  );
}
