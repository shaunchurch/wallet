// Permit signature detection from EIP-712 typed data

const PERMIT_PRIMARY_TYPES = new Set([
  'Permit', // EIP-2612 standard
  'PermitSingle', // Permit2
  'PermitBatch', // Permit2 batch
]);

export interface PermitInfo {
  isPermit: boolean;
  spender?: string | undefined;
  token?: string | undefined;
  amount?: string | undefined;
  deadline?: string | undefined;
}

export function detectPermit(typedData: {
  primaryType: string;
  message?: Record<string, unknown>;
}): PermitInfo {
  if (!PERMIT_PRIMARY_TYPES.has(typedData.primaryType)) {
    return { isPermit: false };
  }
  const msg = typedData.message ?? {};
  return {
    isPermit: true,
    spender: typeof msg.spender === 'string' ? msg.spender : undefined,
    token: typeof msg.token === 'string' ? msg.token : undefined,
    amount:
      msg.value !== undefined
        ? String(msg.value)
        : msg.amount !== undefined
          ? String(msg.amount)
          : undefined,
    deadline: msg.deadline !== undefined ? String(msg.deadline) : undefined,
  };
}
