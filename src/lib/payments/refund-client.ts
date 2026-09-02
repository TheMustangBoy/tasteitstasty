/**
 * Browser-Aufruf der geschützten Admin-Refund-Server-Function.
 * Enthält keinerlei Stripe-Secrets – die gesamte Logik läuft serverseitig.
 */
import {
  refundAndCloseOrder,
  type RefundOrderInput,
  type RefundOrderResult,
} from "@/lib/payments/refund.functions";

export async function refundAndCloseOrderRemote(
  input: RefundOrderInput,
): Promise<RefundOrderResult> {
  return (await refundAndCloseOrder({ data: input })) as RefundOrderResult;
}
