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

export const submitKyc = call<
  { nin: string; selfieStoragePath: string },
  { ok: true }
>('submitKyc');

export const mintKycUploadUrl = call<
  { contentType: string },
  { uploadUrl: string; storagePath: string }
>('mintKycUploadUrl');

export const initiateContribution = call<
  { chamaId: string; contributionId: string; provider: 'mtnMomo' | 'airtelMoney'; msisdn: string; attempt?: number },
  { txId: string }
>('initiateContribution');

export const acceptInvite = call<{ chamaId: string; token: string }, { ok: true }>('acceptInvite');

export const placeBid = call<
  { chamaId: string; cycleId: string; discount: number },
  { bidId: string }
>('placeBid');

export const fileClaim = call<
  { chamaId: string; reason: string; amountRequested: number; evidenceRef: string },
  { claimId: string }
>('fileClaim');

export const mintEvidenceUploadUrl = call<
  { chamaId: string },
  { url: string; path: string }
>('mintEvidenceUploadUrl');

export const requestExit = call<{ chamaId: string }, { ok: true }>('requestExit');
