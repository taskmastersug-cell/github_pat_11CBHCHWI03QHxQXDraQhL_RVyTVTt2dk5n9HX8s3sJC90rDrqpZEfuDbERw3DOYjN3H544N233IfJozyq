import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../..');
const PROJECT_ID = 'roundpay-rules-test';

let env: RulesTestEnvironment | null = null;

export async function getEnv(): Promise<RulesTestEnvironment> {
  if (env) return env;
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(REPO_ROOT, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  return env;
}

export async function cleanup(): Promise<void> {
  if (env) {
    await env.clearFirestore();
  }
}

export async function shutdown(): Promise<void> {
  if (env) {
    await env.cleanup();
    env = null;
  }
}

export const CHAMA_ID = 'chama_test';

export function membershipDocId(chamaId: string, uid: string): string {
  return `${chamaId}_${uid}`;
}

export async function seedChama(env: RulesTestEnvironment, chamaId: string, members: Array<{ uid: string; role: 'member' | 'treasurer' | 'admin'; status?: 'active' | 'invited' | 'suspended' | 'exited' }>, opts: { cycleState?: string } = {}): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('chamas').doc(chamaId).set({
      chamaId, name: 'T', type: 'merryGoRound',
      currency: 'UGX', status: 'active',
      createdBy: 'admin', createdAt: 0, memberCount: members.length,
      cycleLength: { unit: 'week', n: 1 }, contributionAmount: 50_000,
      policies: {
        contribution: { kind: 'periodicFixed', amount: 50_000, cycleCount: 10 },
        selection: { kind: 'discountBid', minDiscount: 0, maxDiscount: 50_000 },
        trigger: { kind: 'onCycleClose' },
        accrual: { kind: 'chitFundDiscountDividend' },
      },
    });
    for (const m of members) {
      const id = membershipDocId(chamaId, m.uid);
      await db.collection('chamas').doc(chamaId).collection('memberships').doc(id).set({
        membershipId: id, chamaId, uid: m.uid, role: m.role,
        status: m.status ?? 'active', joinedAt: 0, share: Math.floor(10_000 / members.length),
      });
    }
    if (opts.cycleState) {
      await db.collection('chamas').doc(chamaId).collection('cycles').doc('cyc1').set({
        cycleId: 'cyc1', chamaId, index: 0, opensAt: 0, closesAt: 9_999_999_999,
        state: opts.cycleState, expectedAmount: 50_000, pool: 0, currency: 'UGX',
      });
    }
  });
}
