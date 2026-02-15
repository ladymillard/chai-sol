import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

// Credit Card Interfaces
interface CreditCard {
  id: string;
  cardId: string;
  owner: string;
  cardholderName: string;
  creditLimit: number;
  availableCredit: number;
  balance: number;
  totalSpent: number;
  totalPayments: number;
  transactionCount: number;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
  pdaAddress?: string;
}

interface CardTransaction {
  id: string;
  cardId: string;
  amount: number;
  merchant: string;
  description: string;
  transactionType: "charge" | "payment" | "refund";
  timestamp: string;
  stripePaymentId?: string;
}

interface User {
  id: string;
  wallet: string;
  email?: string;
  name: string;
  registeredAt: string;
}

// In-memory storage
const creditCards: Map<string, CreditCard> = new Map();
const transactions: Map<string, CardTransaction[]> = new Map();
const users: Map<string, User> = new Map();

// Health check
app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    service: "credit-card-api",
    users: users.size,
    cards: creditCards.size,
  });
});

// User Management
app.post("/users", (req, res) => {
  const { wallet, name, email } = req.body;
  if (!wallet || !name) {
    res.status(400).json({ error: "wallet and name required" });
    return;
  }

  const id = uuidv4();
  const user: User = {
    id,
    wallet,
    name,
    email,
    registeredAt: new Date().toISOString(),
  };
  users.set(id, user);
  res.status(201).json(user);
});

app.get("/users/:id", (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  res.json(user);
});

// Credit Card Management
app.post("/cards", (req, res) => {
  const { owner, cardholderName, creditLimit } = req.body;
  if (!owner || !cardholderName || !creditLimit) {
    res.status(400).json({ error: "owner, cardholderName, and creditLimit required" });
    return;
  }

  const id = uuidv4();
  const cardId = `CHAI-${id.slice(0, 8).toUpperCase()}`;
  const card: CreditCard = {
    id,
    cardId,
    owner,
    cardholderName,
    creditLimit,
    availableCredit: creditLimit,
    balance: 0,
    totalSpent: 0,
    totalPayments: 0,
    transactionCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    pdaAddress: `pda_${id.slice(0, 12)}`,
  };

  creditCards.set(id, card);
  transactions.set(id, []);
  
  res.status(201).json({
    card,
    message: "Digital credit card created successfully",
    blockchain: "solana",
  });
});

app.get("/cards", (req, res) => {
  const owner = req.query.owner as string | undefined;
  let result = Array.from(creditCards.values());
  if (owner) {
    result = result.filter(c => c.owner === owner);
  }
  res.json(result);
});

app.get("/cards/:id", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }
  res.json(card);
});

// Process Transaction (Charge)
app.post("/cards/:id/charge", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  if (!card.isActive) {
    res.status(400).json({ error: "card is not active" });
    return;
  }

  const { amount, merchant, description } = req.body;
  if (!amount || !merchant) {
    res.status(400).json({ error: "amount and merchant required" });
    return;
  }

  if (amount > card.availableCredit) {
    res.status(400).json({ 
      error: "insufficient credit",
      availableCredit: card.availableCredit,
      requestedAmount: amount,
    });
    return;
  }

  // Update card balances
  card.balance += amount;
  card.availableCredit -= amount;
  card.totalSpent += amount;
  card.transactionCount += 1;
  card.lastActivity = new Date().toISOString();

  // Create transaction record
  const transaction: CardTransaction = {
    id: uuidv4(),
    cardId: card.cardId,
    amount,
    merchant,
    description: description || "",
    transactionType: "charge",
    timestamp: new Date().toISOString(),
    stripePaymentId: `stripe_sim_${Date.now()}`,
  };

  const cardTransactions = transactions.get(req.params.id) || [];
  cardTransactions.push(transaction);
  transactions.set(req.params.id, cardTransactions);

  res.json({
    transaction,
    card: {
      balance: card.balance,
      availableCredit: card.availableCredit,
    },
    message: "Transaction processed successfully",
    blockchain: "solana",
  });
});

// Make Payment
app.post("/cards/:id/payment", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  const { amount } = req.body;
  if (!amount) {
    res.status(400).json({ error: "amount required" });
    return;
  }

  if (amount > card.balance) {
    res.status(400).json({ 
      error: "payment exceeds balance",
      currentBalance: card.balance,
      requestedPayment: amount,
    });
    return;
  }

  // Update card balances
  card.balance -= amount;
  card.availableCredit += amount;
  card.totalPayments += amount;
  card.lastActivity = new Date().toISOString();

  // Create transaction record
  const transaction: CardTransaction = {
    id: uuidv4(),
    cardId: card.cardId,
    amount,
    merchant: "Payment",
    description: "Credit card payment",
    transactionType: "payment",
    timestamp: new Date().toISOString(),
    stripePaymentId: `stripe_payment_${Date.now()}`,
  };

  const cardTransactions = transactions.get(req.params.id) || [];
  cardTransactions.push(transaction);
  transactions.set(req.params.id, cardTransactions);

  res.json({
    transaction,
    card: {
      balance: card.balance,
      availableCredit: card.availableCredit,
    },
    message: "Payment processed successfully",
    blockchain: "solana",
  });
});

// Get Transaction History
app.get("/cards/:id/transactions", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  const cardTransactions = transactions.get(req.params.id) || [];
  res.json(cardTransactions);
});

// Update Credit Limit
app.put("/cards/:id/credit-limit", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  const { newLimit } = req.body;
  if (!newLimit) {
    res.status(400).json({ error: "newLimit required" });
    return;
  }

  const oldLimit = card.creditLimit;
  const difference = newLimit - oldLimit;

  card.creditLimit = newLimit;
  // Adjust available credit, ensuring it doesn't go below zero
  card.availableCredit = Math.max(0, card.availableCredit + difference);
  card.lastActivity = new Date().toISOString();

  res.json({
    card,
    message: `Credit limit updated from ${oldLimit} to ${newLimit}`,
    blockchain: "solana",
  });
});

// Activate/Deactivate Card
app.put("/cards/:id/status", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive (boolean) required" });
    return;
  }

  card.isActive = isActive;
  card.lastActivity = new Date().toISOString();

  res.json({
    card,
    message: `Card ${isActive ? "activated" : "deactivated"} successfully`,
  });
});

// Close Card
app.delete("/cards/:id", (req, res) => {
  const card = creditCards.get(req.params.id);
  if (!card) {
    res.status(404).json({ error: "card not found" });
    return;
  }

  if (card.balance !== 0) {
    res.status(400).json({ 
      error: "card balance must be zero before closing",
      currentBalance: card.balance,
    });
    return;
  }

  creditCards.delete(req.params.id);
  transactions.delete(req.params.id);

  res.json({
    message: "Card closed successfully",
    cardId: card.cardId,
  });
});

// Stripe Integration Endpoint (Mock for now)
app.post("/stripe/process-payment", (req, res) => {
  const { cardId, amount, stripeToken } = req.body;
  
  if (!cardId || !amount || !stripeToken) {
    res.status(400).json({ error: "cardId, amount, and stripeToken required" });
    return;
  }

  // In a real implementation, this would integrate with Stripe API
  // For now, we'll simulate a successful payment
  res.json({
    success: true,
    paymentId: `stripe_pi_${Date.now()}`,
    amount,
    message: "Payment processed via Stripe (simulation)",
    note: "This is a temporary integration. Replace with actual Stripe API in production.",
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`ChAI Credit Card API running on port ${PORT}`);
});
