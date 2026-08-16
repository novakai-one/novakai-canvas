import type { LoomZoomTier } from './causal-loom-model';

export function LoomScene({
  waiting,
  missions,
  agents,
  runs,
  tier,
}: {
  waiting: number;
  missions: number;
  agents: number;
  runs: number;
  tier: LoomZoomTier;
}) {
  return (
    <div className="loom-scene" aria-hidden="true">
      <div className="loom-scene__weave" />
      <div className="loom-scene__datum">
        <span>COMMAND / LIVE CAUSAL FIELD</span>
        <span>{waiting} waiting · {missions} mission fields · {agents} agents · {runs} runs</span>
      </div>
      <div className="loom-scene__legend">
        <span data-active={tier === 'overview'}><i /> overview</span>
        <span data-active={tier === 'working'}><i /> working</span>
        <span data-active={tier === 'detail'}><i /> detail</span>
      </div>
    </div>
  );
}
