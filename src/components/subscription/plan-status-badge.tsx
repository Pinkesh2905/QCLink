import { Badge } from '@/components/ui/badge';
import type { SubscriptionStatus } from '@/lib/subscriptions';

export function PlanStatusBadge({ status }: { status: SubscriptionStatus }) {
  if (status === 'active') {
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">Active</Badge>;
  }
  if (status === 'expired') {
    return <Badge className="bg-amber-50 text-amber-800 border-amber-300">Expired</Badge>;
  }
  return <Badge variant="outline">No plan</Badge>;
}
