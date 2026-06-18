// Phase 1: scaffold only. Concrete callable/HTTP/scheduled functions land in
// Phase 2 alongside MoMo/Airtel adapters. The engine is wired here for shape.
import { applyEvent } from '@roundpay/shared';

export const _engineImported = typeof applyEvent;
