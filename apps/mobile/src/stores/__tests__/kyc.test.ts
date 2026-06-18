import { useKycDraft } from '../kyc';

describe('KYC draft store', () => {
  beforeEach(() => useKycDraft.getState().reset());

  it('starts empty', () => {
    expect(useKycDraft.getState().nin).toBeNull();
  });

  it('captures the NIN', () => {
    useKycDraft.getState().setNin('CM1234567890ABC');
    expect(useKycDraft.getState().nin).toBe('CM1234567890ABC');
  });

  it('resets the NIN', () => {
    useKycDraft.getState().setNin('CM1234567890ABC');
    useKycDraft.getState().reset();
    expect(useKycDraft.getState().nin).toBeNull();
  });
});
