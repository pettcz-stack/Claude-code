import { type User } from './api.js';
import { ScoreView } from './ScoreView.js';
import { TrendChart } from './TrendChart.js';
import { TopActivities } from './TopActivities.js';

export function DetailView({ user, from, to, dark }: { user: User; from: string; to: string; dark: boolean }) {
  return (
    <div className="space-y-4">
      <ScoreView user={user} from={from} to={to} />
      <TrendChart from={from} to={to} userId={user.id} dark={dark} />
      <TopActivities from={from} to={to} userId={user.id} />
    </div>
  );
}
