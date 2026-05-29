import { type User } from './api.js';
import { ScoreView } from './ScoreView.js';
import { TrendChart } from './TrendChart.js';
import { TopActivities } from './TopActivities.js';
import { IntegrityPanel } from './IntegrityPanel.js';
import { UserRiskCard } from './UserRiskCard.js';

export function DetailView({ user, from, to, dark }: { user: User; from: string; to: string; dark: boolean }) {
  return (
    <div className="space-y-4">
      {/* Rizikové signály NAHOŘE — manažer vidí nejdřív "co řešit"
          (vyhoření / odchod / pokles výkonu / pochvala), pak teprve čísla. */}
      <UserRiskCard userId={user.id} from={from} to={to} />
      {/* Detekce podvádění (mouse jiggler, evasion SW, atd.) */}
      <IntegrityPanel userId={user.id} from={from} to={to} />
      <ScoreView user={user} from={from} to={to} />
      <TrendChart from={from} to={to} userId={user.id} dark={dark} />
      <TopActivities from={from} to={to} userId={user.id} />
    </div>
  );
}
