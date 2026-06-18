import { money } from '../../money.js';
import {
  memberAccount, poolAccount, poolEquityAccount, reserveAccount,
  providerClearingAccount,
} from '../../ledger/types.js';
import type { Posting } from '../../ledger/types.js';
import type { RoundPayEvent } from '../events.js';
import type { EngineContext, StateUpdate } from '../context.js';

// contributionPaid — provider confirmed the deposit.
// Postings (sums to 0):
//   -X  provider:<provider>:clearing      cash leaves clearing
//   +X  chama:<id>:pool  or  :reserve     cash arrives in chama
//   +X  member:<uid>:<chama>              member's stake increases (equity asset)
//   -X  chama:<id>:poolEquity             chama's claim ledger (equity liability) increases
export function handleContributionPaid(
  event: Extract<RoundPayEvent, { kind: 'contributionPaid' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  const { chama, currency } = ctx;
  const isRolling = chama.policies.contribution.kind === 'periodicRolling';
  const cashAccount = isRolling
    ? reserveAccount(chama.chamaId)
    : poolAccount(chama.chamaId);

  const sourceRef = `contribution:${event.contributionId}`;
  const amount = event.amount;

  const postings: Posting[] = [
    { account: providerClearingAccount(event.provider), amount: money(-amount), currency, sourceKind: 'contribution', sourceRef },
    { account: cashAccount,                             amount,                  currency, sourceKind: 'contribution', sourceRef },
    { account: memberAccount(event.uid, chama.chamaId), amount,                  currency, sourceKind: 'contribution', sourceRef },
    { account: poolEquityAccount(chama.chamaId),        amount: money(-amount), currency, sourceKind: 'contribution', sourceRef },
  ];

  const stateUpdate: StateUpdate = ctx.cycle
    ? { cyclePatch: { pool: money((ctx.cycleContributedAmount ?? 0) + amount) } }
    : {};

  return { postings, stateUpdate };
}
