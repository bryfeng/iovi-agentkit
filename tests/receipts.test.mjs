import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createReceipt, updateReceipt, IoviAgentKit } from '../dist/index.js';

test('creates stable v1 receipts', () => {
  const receipt = createReceipt({
    task: 'payment.transfer',
    status: 'pending',
    custodyMode: 'sandbox-vk',
    verificationMode: 'local',
    services: { paymentSlUrl: 'http://payment' },
    details: { amount: 1 }
  });

  assert.equal(receipt.schema, 'iovi.agent.receipt.v1');
  assert.equal(receipt.task, 'payment.transfer');
  assert.equal(receipt.status, 'pending');
  assert.equal(receipt.details.amount, 1);

  const updated = updateReceipt(receipt, {
    status: 'verified',
    evidence: {
      payload: {
        sequence: 1,
        new_state_hash: 'abc'
      }
    }
  });

  assert.equal(updated.status, 'verified');
  assert.equal(updated.evidence.payload.sequence, 1);
  assert.equal(updated.created_at, receipt.created_at);
  assert.notEqual(updated.updated_at.length, 0);
});

test('sandbox profile wires public service defaults lazily', () => {
  const kit = IoviAgentKit.sandbox();

  assert.match(kit.services.paymentSlUrl, /^https:\/\//);
  assert.match(kit.payment.baseUrl, /^https:\/\//);
});
