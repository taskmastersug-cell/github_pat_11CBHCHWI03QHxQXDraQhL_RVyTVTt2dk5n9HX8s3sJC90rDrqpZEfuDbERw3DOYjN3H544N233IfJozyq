'use client';

import { httpsCallable } from 'firebase/functions';
import { firebase } from './init';

function call<TReq, TRes>(name: string) {
  return async (data: TReq): Promise<TRes> => {
    const { fns } = firebase();
    const fn = httpsCallable<TReq, TRes>(fns, name);
    const result = await fn(data);
    return result.data;
  };
}

export const approveKyc = call<{ uid: string; approve: boolean }, { ok: true }>('approveKyc');

export const approveClaim = call<
  { chamaId: string; claimId: string; approve: boolean },
  { ok: true }
>('approveClaim');

export const readEvidence = call<
  { chamaId: string; path: string },
  { url: string }
>('readEvidence');
