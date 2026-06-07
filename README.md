# IOVI Agent Kit

Headless TypeScript SDK and CLI for AI agents using IOVI/EON semantic-layer services.

This package is a client/orchestration layer. It does not run a verifier, operator,
or base-layer node. It connects to service URLs supplied by the caller.

## Connected Services

| SDK area | Service |
| --- | --- |
| `kit.payment` | Payment SL middleware |
| `kit.verifier` | Generic verifier |
| `kit.baseLayer` | Base-layer posting/read API |
| `kit.bundler` | Bundler/marketplace API |

Sandbox defaults are available with `IoviAgentKit.sandbox()` or `iovi --sandbox`.
Production agents should pass explicit service URLs.

## SDK

```ts
import { IoviAgentKit } from '@iovi/agent-kit';

const kit = new IoviAgentKit({
  paymentSlUrl: process.env.IOVI_PAYMENT_SL_URL,
  verifierUrl: process.env.IOVI_VERIFIER_URL,
  bundlerUrl: process.env.IOVI_BUNDLER_URL,
  baseLayerUrl: process.env.IOVI_BASE_LAYER_URL
});

const receipt = await kit.paymentWorkflow.transferAndVerify({
  layer: { slId: '00010001', version: '0001', assetId: 'PAYMENT' },
  fromAddress: '40_hex_chars',
  toAddress: '40_hex_chars',
  amount: 1,
  vk: process.env.ALICE_PAYMENT_VK!,
  verificationMode: 'local'
});
```

Every workflow returns an `iovi.agent.receipt.v1` JSON object with payload,
base-post, and verifier evidence when available.

## CLI

```bash
npm install
npm run build
node dist/cli.js --sandbox health
```

Create a Payment SL lane:

```bash
node dist/cli.js --sandbox payment create-layer \
  --sl-id a9bca654 \
  --name "Agent Payment SL" \
  --issuer-vk issuer_vk \
  --operator-vk operator_vk \
  --asset-id PAYMENT \
  --asset-symbol USD \
  --asset-name "Payment token" \
  --asset-decimals 6
```

Register user wallets:

```bash
node dist/cli.js --sandbox wallet register --label Alice --vk alice_vk --kind user
node dist/cli.js --sandbox wallet register --label Bob --vk bob_vk --kind user
```

Mint and verify locally:

```bash
node dist/cli.js --sandbox payment mint \
  --sl-id a9bca654 \
  --to 40_hex_chars \
  --amount 100 \
  --verify local
```

Transfer and verify locally:

```bash
node dist/cli.js --sandbox payment transfer \
  --sl-id a9bca654 \
  --from 40_hex_chars \
  --to 40_hex_chars \
  --amount 1 \
  --vk alice_vk \
  --verify local
```

## Custody Modes

The first Payment workflow supports the current sandbox auth model and labels it
as `sandbox-vk` in receipts. Production money-like flows should move to signed,
expiring, replay-safe intents before this SDK is treated as a custody boundary.

Supported receipt custody labels:

- `sandbox-vk`
- `local-key`
- `remote-poster`
- `watch-only`

## Development

```bash
npm install
npm test
```
