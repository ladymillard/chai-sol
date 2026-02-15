# Stripe Integration Guide for ChAI Credit Card System

## Overview

This guide explains how to integrate Stripe payment processing with the ChAI Digital Credit Card System. The current implementation includes a simulated Stripe endpoint that should be replaced with actual Stripe API calls for production use.

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **API Keys**: Get your Stripe API keys from the Stripe Dashboard
3. **Node.js Stripe Library**: Install the official Stripe SDK

## Installation

```bash
cd backend
npm install stripe
npm install --save-dev @types/stripe
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Update Backend Service

Add Stripe initialization to `credit-card-service.ts`:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
```

## Implementation

### 1. Payment Intent Creation

Replace the simulated endpoint with real Stripe integration:

```typescript
app.post("/stripe/create-payment-intent", async (req, res) => {
  const { cardId, amount, currency = "usd" } = req.body;
  
  try {
    const card = creditCards.get(cardId);
    if (!card) {
      res.status(404).json({ error: "card not found" });
      return;
    }

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe uses cents
      currency: currency,
      metadata: {
        cardId: cardId,
        chainCardId: card.cardId,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Payment Confirmation

Handle successful payments:

```typescript
app.post("/stripe/confirm-payment", async (req, res) => {
  const { paymentIntentId, cardId } = req.body;
  
  try {
    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const card = creditCards.get(cardId);
      if (!card) {
        res.status(404).json({ error: "card not found" });
        return;
      }

      const amount = paymentIntent.amount / 100; // Convert from cents
      
      // Process the payment on the credit card
      // This would be the payment reducing the balance
      card.balance -= amount;
      card.availableCredit += amount;
      card.totalPayments += amount;
      card.lastActivity = new Date().toISOString();

      // Record transaction
      const transaction: CardTransaction = {
        id: uuidv4(),
        cardId: card.cardId,
        amount: amount,
        merchant: "Stripe Payment",
        description: `Payment via Stripe (${paymentIntentId})`,
        transactionType: "payment",
        timestamp: new Date().toISOString(),
        stripePaymentId: paymentIntentId,
      };

      const cardTransactions = transactions.get(cardId) || [];
      cardTransactions.push(transaction);
      transactions.set(cardId, cardTransactions);

      res.json({
        success: true,
        transaction,
        card: {
          balance: card.balance,
          availableCredit: card.availableCredit,
        },
      });
    } else {
      res.status(400).json({ error: "Payment not successful" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Webhook Handler

Handle Stripe webhooks for asynchronous events:

```typescript
app.post("/stripe/webhook", express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      // Update your database/state
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('PaymentIntent failed:', failedPayment.id);
      // Handle failed payment
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});
```

## Frontend Integration

### Update Wallet UI

Add Stripe.js to `chai-wallet.html`:

```html
<script src="https://js.stripe.com/v3/"></script>
```

### Initialize Stripe

```javascript
const stripe = Stripe('pk_test_your_publishable_key_here');
```

### Create Payment Form

Add a payment form with Stripe Elements:

```javascript
async function processStripePayment(amount) {
  // Create payment intent
  const response = await fetch(`${API_URL}/stripe/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId: currentCardId,
      amount: amount,
      currency: 'usd'
    })
  });
  
  const { clientSecret, paymentIntentId } = await response.json();
  
  // Confirm the payment
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement, // Stripe card element
      billing_details: {
        name: currentCard.cardholderName,
      },
    },
  });
  
  if (result.error) {
    alert('Payment failed: ' + result.error.message);
  } else {
    // Confirm with backend
    await fetch(`${API_URL}/stripe/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId,
        cardId: currentCardId
      })
    });
    alert('Payment successful!');
  }
}
```

## Testing

### Test Mode

Use Stripe test mode for development:

**Test Card Numbers:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

**Test Details:**
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

### Testing Flow

1. Create a credit card via API
2. Make a test payment using Stripe test card
3. Verify payment appears in transaction history
4. Check balance updates correctly

## Security Best Practices

### 1. Never Expose Secret Keys
- Keep `STRIPE_SECRET_KEY` server-side only
- Use environment variables
- Never commit keys to version control

### 2. Validate Webhooks
- Always verify webhook signatures
- Use the webhook secret from Stripe Dashboard

### 3. Handle Errors Gracefully
- Catch all Stripe API errors
- Provide clear error messages to users
- Log errors for debugging

### 4. Use HTTPS
- Always use HTTPS in production
- Stripe requires HTTPS for webhooks

## Production Checklist

- [ ] Switch from test keys to live keys
- [ ] Configure webhook endpoints in Stripe Dashboard
- [ ] Set up proper error logging
- [ ] Implement rate limiting
- [ ] Add retry logic for failed API calls
- [ ] Set up monitoring for payment success/failure rates
- [ ] Implement proper database instead of in-memory storage
- [ ] Add idempotency keys to prevent duplicate charges
- [ ] Test all payment scenarios thoroughly
- [ ] Review Stripe security guidelines

## Integration with Solana Smart Contract

### Hybrid Approach

For full integration:

1. **Payment Processing**: Use Stripe for fiat payment processing
2. **Record on Chain**: Record all transactions on Solana blockchain
3. **Sync State**: Keep Stripe and blockchain state synchronized

```typescript
async function processHybridPayment(cardId: string, amount: number) {
  // 1. Process via Stripe
  const stripePayment = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: 'usd',
    metadata: { cardId }
  });
  
  // 2. If successful, record on blockchain
  if (stripePayment.status === 'succeeded') {
    const tx = await program.methods
      .makePayment(new BN(amount))
      .accounts({
        owner: wallet.publicKey,
        creditCard: cardPDA,
        transaction: transactionPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Blockchain tx:', tx);
  }
}
```

## Support

For Stripe-specific issues:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

For integration issues:
- Check ChAI repository issues
- Review CREDIT_CARD_SYSTEM.md

---

**Note**: This is a development guide. Ensure compliance with all payment processing regulations in your jurisdiction before going to production.
