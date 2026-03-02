import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { detectPermit } from '@/features/dapp/permit-detect';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { Header } from '../components/Header';

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function SiteInfo({
  favicon,
  title,
  origin,
}: {
  favicon?: string | undefined;
  title?: string | undefined;
  origin: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="size-8 rounded"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex size-8 items-center justify-center rounded bg-zinc-200 text-xs font-bold dark:bg-zinc-700">
          {(title || origin).charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold">{title || new URL(origin).hostname}</p>
        <p className="text-xs text-zinc-400">{origin}</p>
      </div>
    </div>
  );
}

/** Try to decode hex to UTF-8 */
function hexToUtf8(hex: string): string | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return null;
  }
}

function formatDeadline(deadline: string): string {
  const num = Number(deadline);
  if (Number.isNaN(num) || num === 0) return deadline;
  // If very large, treat as timestamp
  if (num > 1_000_000_000) {
    return new Date(num * 1000).toLocaleString();
  }
  return deadline;
}

function PersonalSignContent({ message }: { message: string }) {
  const decoded = hexToUtf8(message);
  const displayText = decoded ?? message;

  // Detect JSON
  const trimmed = displayText.trim();
  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  return (
    <div className="mx-4 max-h-[250px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      {isJson ? (
        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(trimmed), null, 2);
            } catch {
              return trimmed;
            }
          })()}
        </pre>
      ) : decoded ? (
        <p className="whitespace-pre-wrap break-all text-sm text-zinc-800 dark:text-zinc-200">
          {displayText}
        </p>
      ) : (
        <p className="break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {displayText}
        </p>
      )}
    </div>
  );
}

function renderValue(key: string, value: unknown, depth = 0): React.ReactNode {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div key={key} className="mt-1" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        <span className="text-zinc-500">{key}:</span>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          renderValue(k, v, depth + 1),
        )}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div key={key} className="mt-1" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        <span className="text-zinc-500">{key}:</span> [{value.length} items]
        {value.map((item, i) => renderValue(String(i), item, depth + 1))}
      </div>
    );
  }
  return (
    <div key={key} style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      <span className="text-zinc-500">{key}:</span>{' '}
      <span className="text-zinc-900 dark:text-zinc-100">{String(value)}</span>
    </div>
  );
}

function TypedDataContent({ typedData }: { typedData: Record<string, unknown> }) {
  const domain = (typedData.domain as Record<string, unknown>) ?? {};
  const primaryType = (typedData.primaryType as string) ?? 'Unknown';
  const message = (typedData.message as Record<string, unknown>) ?? {};

  const permit = detectPermit({ primaryType, message });

  return (
    <>
      {permit.isPermit && (
        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            This grants token spending approval
          </p>
          <div className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-300">
            {permit.spender && <p>Spender: {truncateAddr(permit.spender)}</p>}
            {permit.token && <p>Token: {truncateAddr(permit.token)}</p>}
            {permit.amount && <p>Amount: {permit.amount}</p>}
            {permit.deadline && <p>Deadline: {formatDeadline(permit.deadline)}</p>}
          </div>
        </div>
      )}
      <div className="mx-4 max-h-[220px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
        <div className="font-semibold text-zinc-500">Domain</div>
        {Object.entries(domain).map(([k, v]) => (
          <div key={k} className="pl-3">
            {k}: <span className="text-zinc-900 dark:text-zinc-100">{String(v)}</span>
          </div>
        ))}
        <div className="mt-2 font-semibold text-zinc-500">{primaryType}</div>
        {Object.entries(message).map(([k, v]) => renderValue(k, v))}
      </div>
    </>
  );
}

export function DappSignScreen() {
  const pendingDappRequest = useWalletStore((s) => s.pendingDappRequest);
  const [loading, setLoading] = useState(false);

  if (!pendingDappRequest) {
    return (
      <>
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-zinc-400">No pending request</span>
        </div>
      </>
    );
  }

  const { id, method, params, origin, favicon, title } = pendingDappRequest;
  const isTypedData = method === 'eth_signTypedData_v4';

  async function handleReject() {
    await sendWalletMessage({ type: 'dapp:reject', requestId: id });
    window.close();
  }

  async function handleSign() {
    setLoading(true);
    try {
      if (isTypedData) {
        const typedDataStr = (params as unknown[])?.[1] as string;
        const account = (params as unknown[])?.[0] as string;
        await sendWalletMessage({
          type: 'dapp:signTypedData',
          requestId: id,
          typedData: JSON.parse(typedDataStr),
          account,
        });
      } else {
        // personal_sign: params[0] = hex message, params[1] = address
        const message = (params as unknown[])?.[0] as string;
        const account = (params as unknown[])?.[1] as string;
        await sendWalletMessage({
          type: 'dapp:signPersonal',
          requestId: id,
          message,
          account,
        });
      }
      window.close();
    } catch {
      setLoading(false);
    }
  }

  // Parse typed data for display
  let typedData: Record<string, unknown> | null = null;
  if (isTypedData) {
    try {
      typedData = JSON.parse((params as unknown[])?.[1] as string) as Record<string, unknown>;
    } catch {
      // leave null
    }
  }

  const personalMessage = !isTypedData ? (((params as unknown[])?.[0] as string) ?? '') : '';

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SiteInfo favicon={favicon} title={title} origin={origin} />

        <p className="mb-3 px-4 text-sm text-zinc-500 dark:text-zinc-400">
          {isTypedData ? 'Signature request (EIP-712)' : 'Signature request'}
        </p>

        {isTypedData && typedData ? (
          <TypedDataContent typedData={typedData} />
        ) : (
          <PersonalSignContent message={personalMessage} />
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-3 px-4 pb-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={handleReject} disabled={loading}>
            Reject
          </Button>
          <Button className="flex-1" onClick={handleSign} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing...
              </span>
            ) : (
              'Sign'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
