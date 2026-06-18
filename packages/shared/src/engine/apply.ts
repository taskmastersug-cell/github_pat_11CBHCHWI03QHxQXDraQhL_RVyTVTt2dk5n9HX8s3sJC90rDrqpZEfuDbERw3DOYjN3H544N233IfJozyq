import type { Posting } from '../ledger/types.js';
import { assertBalanced } from '../ledger/invariants.js';
import type { RoundPayEvent } from './events.js';
import type { EngineContext, StateUpdate } from './context.js';
import { handleContributionPaid } from './policies/contribution.js';
import { handleCycleClosed } from './policies/cycleClose.js';
import {
  handleBidPlaced, handleClaimApproved, handleMaturityReached,
} from './policies/claimApproval.js';

export interface EngineResult {
  readonly postings: readonly Posting[];
  readonly stateUpdate: StateUpdate;
}

// applyEvent is the only entry point. No branching on chama.type — branching
// is by event.kind, and within each handler the policy registry is consulted.
export function applyEvent(event: RoundPayEvent, ctx: EngineContext): EngineResult {
  let result: EngineResult;
  switch (event.kind) {
    case 'contributionPaid': result = handleContributionPaid(event, ctx); break;
    case 'bidPlaced':        result = handleBidPlaced(event, ctx); break;
    case 'cycleClosed':      result = handleCycleClosed(event, ctx); break;
    case 'maturityReached':  result = handleMaturityReached(event, ctx); break;
    case 'claimApproved':    result = handleClaimApproved(event, ctx); break;
  }
  if (result.postings.length > 0) assertBalanced(result.postings);
  return result;
}
