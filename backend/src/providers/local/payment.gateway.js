import { createHash, randomUUID } from 'node:crypto';
import { badRequest } from '../../errors.js';

const idempotentResults = new Map();

export const paymentGateway = {
  name: 'local-sandbox',

  async charge({ amountCents, paymentMethodToken, idempotencyKey }) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw badRequest('Payment amount must be a positive number of cents');
    if (!paymentMethodToken) throw badRequest('A tokenized payment method is required');
    const key = String(idempotencyKey || '').trim();
    if (!key) throw badRequest('An idempotency key is required');
    if (idempotentResults.has(key)) return idempotentResults.get(key);

    const result = {
      provider: 'local-sandbox',
      providerPaymentId: `sandbox-payment-${randomUUID()}`,
      status: 'Succeeded',
      amountCents,
      paymentMethodFingerprint: createHash('sha256').update(paymentMethodToken).digest('hex').slice(0, 16),
      processedAt: new Date().toISOString(),
    };
    idempotentResults.set(key, result);
    return result;
  },
};
