#!/usr/bin/env node
import { IoviAgentKit } from './index.js';
import type { AgentKitOptions, AssetRef, LayerRef, SemanticLayerAsset, VerificationMode } from './types.js';

type ParsedArgs = {
  command: string[];
  flags: Record<string, string | boolean>;
};

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command.length === 0 || parsed.flags.help === true) {
    printHelp();
    return;
  }

  const kit = buildKit(parsed.flags);
  const [scope, action] = parsed.command;

  if (scope === 'health') {
    await printJson({
      payment: await safe(() => kit.payment.health()),
      verifier: await safe(() => kit.verifier.health()),
      bundler: await safe(() => kit.bundler.health()),
      base_layer: await safe(() => kit.baseLayer.health())
    });
    return;
  }

  if (scope === 'wallet' && action === 'register') {
    const wallet = await kit.payment.registerWallet({
      label: stringFlag(parsed.flags, 'label'),
      vk: stringFlag(parsed.flags, 'vk'),
      address: stringFlag(parsed.flags, 'address'),
      kind: walletKind(parsed.flags)
    });
    await printJson(wallet);
    return;
  }

  if (scope === 'wallet' && action === 'list') {
    await printJson(await kit.payment.listWallets());
    return;
  }

  if (scope === 'payment' && action === 'create-layer') {
    const assets = parseAssets(parsed.flags);
    const receipt = await kit.paymentWorkflow.createLayer({
      name: requireFlag(parsed.flags, 'name'),
      layer: layerFromFlags(parsed.flags),
      issuerVk: requireFlag(parsed.flags, 'issuer-vk'),
      operator: {
        label: stringFlag(parsed.flags, 'operator-label') ?? 'Payment SL Operator',
        vk: stringFlag(parsed.flags, 'operator-vk'),
        address: stringFlag(parsed.flags, 'operator-address')
      },
      baseLayerAccountId: stringFlag(parsed.flags, 'base-layer-account-id'),
      resetExisting: boolFlag(parsed.flags, 'reset-existing'),
      assets
    });
    await printJson(receipt);
    return;
  }

  if (scope === 'payment' && action === 'mint') {
    const receipt = await kit.paymentWorkflow.mintAndVerify({
      layer: layerFromFlags(parsed.flags, { allowDefault: true }),
      toAddress: requireFlag(parsed.flags, 'to'),
      amount: numberFlag(parsed.flags, 'amount'),
      verificationMode: verificationMode(parsed.flags)
    });
    await printJson(receipt);
    return;
  }

  if (scope === 'payment' && action === 'transfer') {
    const receipt = await kit.paymentWorkflow.transferAndVerify({
      layer: layerFromFlags(parsed.flags, { allowDefault: true }),
      fromAddress: requireFlag(parsed.flags, 'from'),
      toAddress: requireFlag(parsed.flags, 'to'),
      amount: numberFlag(parsed.flags, 'amount'),
      vk: requireFlag(parsed.flags, 'vk'),
      verificationMode: verificationMode(parsed.flags)
    });
    await printJson(receipt);
    return;
  }

  if (scope === 'payment' && action === 'batch') {
    const receipt = await kit.paymentWorkflow.batchAndVerify({
      layer: layerFromFlags(parsed.flags, { allowDefault: true }),
      verificationMode: verificationMode(parsed.flags),
      force: boolFlag(parsed.flags, 'force'),
      sequence: optionalNumberFlag(parsed.flags, 'sequence'),
      verifierTimeoutSeconds: optionalNumberFlag(parsed.flags, 'verifier-timeout-seconds'),
      verifierPollIntervalSeconds: optionalNumberFlag(parsed.flags, 'verifier-poll-interval-seconds')
    });
    await printJson(receipt);
    return;
  }

  if (scope === 'marketplace' && action === 'quote-exact-in') {
    const inputAsset: AssetRef = {
      sl_id: requireFlag(parsed.flags, 'input-sl-id'),
      version: stringFlag(parsed.flags, 'input-version') ?? '0001',
      asset_id: requireFlag(parsed.flags, 'input-asset-id')
    };
    const receipt = await kit.marketplaceWorkflow.quoteExactIn({
      poolId: requireFlag(parsed.flags, 'pool-id'),
      inputAsset,
      amountIn: numberFlag(parsed.flags, 'amount-in')
    });
    await printJson(receipt);
    return;
  }

  throw new Error(`unknown command: ${parsed.command.join(' ')}`);
}

function buildKit(flags: Record<string, string | boolean>): IoviAgentKit {
  const options: AgentKitOptions = {
    profile: boolFlag(flags, 'sandbox') ? 'sandbox' : 'custom',
    paymentSlUrl: stringFlag(flags, 'payment-url') ?? envFirst('IOVI_PAYMENT_SL_URL', 'PAYMENT_SL'),
    verifierUrl: stringFlag(flags, 'verifier-url') ?? envFirst('IOVI_VERIFIER_URL', 'VERIFIER'),
    bundlerUrl: stringFlag(flags, 'bundler-url') ?? envFirst('IOVI_BUNDLER_URL', 'BUNDLER_MARKETPLACE'),
    baseLayerUrl: stringFlag(flags, 'base-layer-url') ?? envFirst('IOVI_BASE_LAYER_URL', 'BASE_LAYER')
  };
  return new IoviAgentKit(options);
}

function parseArgs(args: string[]): ParsedArgs {
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const booleanFlags = new Set(['sandbox', 'help', 'reset-existing', 'force']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      command.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (booleanFlags.has(name)) {
      flags[name] = true;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      flags[name] = true;
      continue;
    }
    flags[name] = next;
    index += 1;
  }
  return { command, flags };
}

function layerFromFlags(flags: Record<string, string | boolean>, options: { allowDefault?: boolean } = {}): LayerRef {
  const slId = stringFlag(flags, 'sl-id');
  if (!slId && !options.allowDefault) throw new Error('missing required flag --sl-id');
  return {
    slId: slId ?? '00010001',
    version: stringFlag(flags, 'version') ?? '0001',
    assetId: stringFlag(flags, 'asset-id')
  };
}

function parseAssets(flags: Record<string, string | boolean>): SemanticLayerAsset[] {
  const assetId = stringFlag(flags, 'asset-id');
  if (!assetId) return [];
  return [{
    asset_id: assetId,
    symbol: stringFlag(flags, 'asset-symbol') ?? assetId,
    name: stringFlag(flags, 'asset-name') ?? assetId,
    decimals: optionalNumberFlag(flags, 'asset-decimals') ?? 0,
    asset_type: stringFlag(flags, 'asset-type') ?? 'fungible'
  }];
}

function verificationMode(flags: Record<string, string | boolean>): VerificationMode {
  const mode = stringFlag(flags, 'verify') ?? 'local';
  if (mode !== 'local' && mode !== 'devnet' && mode !== 'none') {
    throw new Error('--verify must be one of: local, devnet, none');
  }
  return mode;
}

function walletKind(flags: Record<string, string | boolean>) {
  const kind = stringFlag(flags, 'kind') ?? 'user';
  if (kind !== 'user' && kind !== 'sl_operator' && kind !== 'coordinator' && kind !== 'verifier') {
    throw new Error('--kind must be one of: user, sl_operator, coordinator, verifier');
  }
  return kind;
}

function requireFlag(flags: Record<string, string | boolean>, name: string): string {
  const value = stringFlag(flags, name);
  if (!value) throw new Error(`missing required flag --${name}`);
  return value;
}

function stringFlag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
}

function numberFlag(flags: Record<string, string | boolean>, name: string): number {
  const value = optionalNumberFlag(flags, name);
  if (value === undefined) throw new Error(`missing required numeric flag --${name}`);
  return value;
}

function optionalNumberFlag(flags: Record<string, string | boolean>, name: string): number | undefined {
  const raw = stringFlag(flags, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
}

function boolFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true || flags[name] === 'true';
}

function envFirst(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

async function safe(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function printJson(value: unknown): Promise<void> {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp(): void {
  process.stdout.write(`IOVI Agent Kit

Usage:
  iovi --sandbox health
  iovi --sandbox wallet register --label Alice --vk alice_vk --kind user
  iovi payment create-layer --sl-id a9bca654 --name "Payment SL" --issuer-vk issuer --operator-vk operator
  iovi payment mint --sl-id a9bca654 --to <address> --amount 100 --verify local
  iovi payment transfer --sl-id a9bca654 --from <address> --to <address> --amount 1 --vk <vk> --verify local
  iovi payment batch --sl-id a9bca654 --verify devnet
  iovi marketplace quote-exact-in --pool-id pool-stock-usd --input-sl-id 00020002 --input-asset-id USD --amount-in 1000

Service flags:
  --sandbox
  --payment-url <url>
  --verifier-url <url>
  --bundler-url <url>
  --base-layer-url <url>

Environment:
  IOVI_PAYMENT_SL_URL or PAYMENT_SL
  IOVI_VERIFIER_URL or VERIFIER
  IOVI_BUNDLER_URL or BUNDLER_MARKETPLACE
  IOVI_BASE_LAYER_URL or BASE_LAYER
`);
}

main().catch(async (error: unknown) => {
  await printJson({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
