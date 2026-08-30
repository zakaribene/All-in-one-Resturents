const { decrypt } = require('./crypto');
const waafipay = require('./waafipay');

// Charges an order's total against a connected PaymentAccount. Mutates and saves
// the order's payment sub-document, then returns either `{ outcome: 'paid' }` or
// `{ outcome: 'declined', body }` where `body` is the exact 402 response shape
// both the public ordering flow and the restaurant POS use.
async function chargeOrderPayment(order, account, { phone }) {
  order.payment.referenceId = String(order._id);
  order.payment.invoiceId = 'INV-' + order._id;
  order.payment.status = 'pending';
  order.payment.provider = account.provider;
  order.payment.amount = order.total;
  order.payment.currency = account.currency;
  await order.save();

  const decryptedAccount = {
    baseUrl: account.baseUrl,
    merchantUid: account.merchantUid,
    apiUserId: decrypt(account.apiUserId),
    apiKey: decrypt(account.apiKey),
    currency: account.currency,
  };

  const result = await waafipay.chargePurchase(decryptedAccount, {
    referenceId: order.payment.referenceId,
    invoiceId: order.payment.invoiceId,
    amount: order.total,
    phone,
    description: `Order #${order.number}`,
  });

  if (result.ok) {
    order.payment.status = 'paid';
    order.payment.transactionId = result.transactionId;
    order.payment.issuerTransactionId = result.issuerTransactionId;
    order.payment.paidAt = new Date();
    await order.save();
    return { outcome: 'paid' };
  }

  if (result.timeout) {
    order.payment.status = 'timeout';
    await order.save();
    return {
      outcome: 'declined',
      body: {
        error: 'Lama xaqiijin lacag-bixinta · Payment could not be confirmed in time',
        orderId: order._id, allowRetry: false, allowPayAtTable: true, needsManualVerification: true,
      },
    };
  }

  if (result.networkError) {
    order.payment.status = 'failed';
    await order.save();
    return {
      outcome: 'declined',
      body: {
        error: 'Adeegga lacag-bixinta lama gaarin · Could not reach the payment provider, please try again',
        orderId: order._id, allowRetry: true, allowPayAtTable: true,
      },
    };
  }

  order.payment.status = 'declined';
  order.payment.failureReason = result.raw?.responseMsg || result.state || null;
  await order.save();
  return {
    outcome: 'declined',
    body: {
      error: 'Lacagta lama aqbalin · Payment was declined',
      orderId: order._id, allowRetry: true, allowPayAtTable: true,
      reason: order.payment.failureReason,
    },
  };
}

module.exports = { chargeOrderPayment };
