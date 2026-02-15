# 💳 ChAI Digital Credit Card System

## Overview

The ChAI Digital Credit Card System is a blockchain-powered credit card solution that eliminates the need for physical plastic cards. Built on Solana using Anchor framework, it provides a fully digital, secure, and smart contract-managed credit system.

## Key Features

### 1. **Digital Card Storage**
- Cards live in your digital wallet on your phone
- No physical card required
- Accessible through web interface
- Secure blockchain-based storage

### 2. **Smart Contract-Powered Credits**
- Solana Anchor smart contracts manage all credit operations
- Dynamic credit limits based on user behavior
- Automated transaction processing
- On-chain balance and payment tracking

### 3. **Stripe Integration (Temporary)**
- Stripe integration for payment processing during development
- Easy migration path to native blockchain payments
- Simulated payment processing in current implementation

### 4. **User Tracking & Security**
- Wallet-based authentication
- Transaction history tracking
- Secure credit limit management
- Owner-only access controls

### 5. **No Physical Cards**
- 100% digital solution
- Instant card creation
- Real-time balance updates
- Blockchain-verified transactions

## Architecture

```
╔═══════════════════════════════════════════════════════════╗
║                  Frontend (Wallet UI)                      ║
║          chai-wallet.html - Digital Card Display           ║
╚══════════════════════╤════════════════════════════════════╝
                       │
╔══════════════════════▼════════════════════════════════════╗
║               Backend API Server                           ║
║        credit-card-service.ts - Card Management            ║
║          - Card creation & management                      ║
║          - Transaction processing                          ║
║          - Payment handling                                ║
║          - Stripe integration                              ║
╚══════════════════════╤════════════════════════════════════╝
                       │
╔══════════════════════▼════════════════════════════════════╗
║          Solana Smart Contract (Anchor)                    ║
║        programs/credit_card/src/lib.rs                     ║
║          - CreditCard account (PDA)                        ║
║          - Transaction records                             ║
║          - Credit limit management                         ║
║          - Payment processing                              ║
╚══════════════════════╤════════════════════════════════════╝
                       │
╔══════════════════════▼════════════════════════════════════╗
║                  Solana Blockchain                         ║
║          - Account storage                                 ║
║          - Transaction validation                          ║
║          - SOL transfers                                   ║
╚═══════════════════════════════════════════════════════════╝
```

## Smart Contract Details

### Program ID
```
Credit11111111111111111111111111111111111111
```

### Accounts

#### CreditCard Account
Stores all credit card information on-chain:
- Owner (Pubkey)
- Card ID (unique identifier)
- Cardholder name
- Credit limit
- Available credit
- Current balance
- Transaction statistics
- Active status
- Timestamps

#### Transaction Account
Records each transaction:
- Card owner reference
- Amount
- Merchant
- Description
- Transaction type (Charge/Payment/Refund)
- Timestamp

### Instructions

1. **initialize_card**: Create a new digital credit card
2. **process_transaction**: Charge an amount to the card
3. **make_payment**: Make a payment to reduce balance
4. **update_credit_limit**: Dynamically adjust credit limit
5. **set_card_status**: Activate or deactivate card
6. **close_card**: Close card account (requires zero balance)

## API Endpoints

### Health Check
```
GET /health
Response: { status: "ok", service: "credit-card-api", users: 0, cards: 0 }
```

### User Management
```
POST /users
Body: { wallet, name, email? }
Response: User object

GET /users/:id
Response: User object
```

### Card Management
```
POST /cards
Body: { owner, cardholderName, creditLimit }
Response: { card, message, blockchain }

GET /cards
Query: owner? (optional filter)
Response: Array of cards

GET /cards/:id
Response: Card object
```

### Transactions
```
POST /cards/:id/charge
Body: { amount, merchant, description }
Response: { transaction, card, message }

POST /cards/:id/payment
Body: { amount }
Response: { transaction, card, message }

GET /cards/:id/transactions
Response: Array of transactions
```

### Card Operations
```
PUT /cards/:id/credit-limit
Body: { newLimit }
Response: { card, message }

PUT /cards/:id/status
Body: { isActive }
Response: { card, message }

DELETE /cards/:id
Response: { message, cardId }
```

### Stripe Integration
```
POST /stripe/process-payment
Body: { cardId, amount, stripeToken }
Response: { success, paymentId, amount, message }
Note: Currently simulated, requires Stripe API integration
```

## Setup Instructions

### Prerequisites
- Node.js 16+
- Rust and Cargo
- Solana CLI tools
- Anchor framework

### Installation

1. **Clone the repository**
```bash
cd /home/runner/work/chai-sol/chai-sol
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Build Solana program**
```bash
cd ..
anchor build
```

4. **Deploy program (optional)**
```bash
anchor deploy
```

5. **Start backend API**
```bash
cd backend
npm run dev
```

6. **Open wallet UI**
Open `frontend/chai-wallet.html` in a web browser

## Usage Guide

### Creating a Card

1. Access the wallet UI at `frontend/chai-wallet.html`
2. On first load, a demo card is automatically created
3. Or use the API:
```javascript
POST /cards
{
  "owner": "wallet_address",
  "cardholderName": "John Doe",
  "creditLimit": 10000000000  // in lamports (10 SOL)
}
```

### Making a Purchase

1. Click "💳 New Purchase" in the wallet UI
2. Enter merchant name, amount, and description
3. Submit to process the charge

Or via API:
```javascript
POST /cards/{cardId}/charge
{
  "amount": 1000000000,  // 1 SOL in lamports
  "merchant": "Amazon",
  "description": "Books"
}
```

### Making a Payment

1. Click "💵 Make Payment" in the wallet UI
2. Enter payment amount
3. Submit to reduce balance

Or via API:
```javascript
POST /cards/{cardId}/payment
{
  "amount": 1000000000  // 1 SOL in lamports
}
```

### Updating Credit Limit

Dynamic credit limit adjustment:
```javascript
PUT /cards/{cardId}/credit-limit
{
  "newLimit": 20000000000  // 20 SOL in lamports
}
```

## Security Features

### Wallet-Based Authentication
- Cards are tied to Solana wallet addresses
- Only the owner can perform operations
- Smart contract enforces ownership validation

### Transaction Validation
- Credit limit checks before charges
- Balance validation for payments
- Status verification (active/inactive)

### On-Chain Security
- All transactions recorded on blockchain
- Immutable transaction history
- Cryptographic verification

## Future Enhancements

### Planned Features
1. **Multi-signature support** - Require multiple approvals for high-value transactions
2. **Rewards program** - Earn tokens for card usage
3. **Credit score integration** - Dynamic limits based on blockchain reputation
4. **Mobile app** - Native iOS/Android wallet
5. **Full Stripe integration** - Production-ready payment processing
6. **NFT card designs** - Customizable card appearances as NFTs
7. **Spending categories** - Categorize and analyze spending
8. **Auto-payments** - Scheduled automatic payments

## Testing

### Manual Testing
1. Start the backend API
2. Open wallet UI in browser
3. Test card creation, charges, and payments
4. Verify transaction history updates

### Integration Testing
```bash
# Run backend tests (when implemented)
cd backend
npm test

# Run smart contract tests
anchor test
```

## Troubleshooting

### Common Issues

**Card not loading**
- Ensure backend API is running on port 3002
- Check browser console for CORS errors
- Verify API_URL in wallet HTML

**Transaction failed**
- Check available credit
- Verify card is active
- Ensure amounts are in correct format (lamports)

**Smart contract errors**
- Rebuild with `anchor build`
- Verify program deployment
- Check account PDAs are correctly derived

## Development Notes

### Currency Format
- All amounts are stored in lamports (1 SOL = 1,000,000,000 lamports)
- Frontend displays in SOL for readability
- Backend accepts/returns lamports

### PDA Seeds
Cards use seeds: `["credit_card", owner.key(), card_id]`
Transactions use seeds: `["transaction", card.key(), transaction_count]`

### Temporary Features
- In-memory storage (replace with database)
- Simulated Stripe integration (add real Stripe API)
- Demo card creation (implement proper onboarding)

## Support

For issues or questions:
- GitHub Issues: [chai-sol repository](https://github.com/ladymillard/chai-sol)
- Documentation: See `/book` directory
- Team: ChAI AI Ninja

---

Built with 💜 by ChAI AI Agents
Powered by Solana & Anchor Framework
