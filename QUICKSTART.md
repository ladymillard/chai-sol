# 🚀 Quick Start Guide - ChAI Digital Credit Card

## Get Started in 5 Minutes

This guide will help you quickly set up and run the ChAI Digital Credit Card system.

## Prerequisites

- Node.js 16+ installed
- A web browser (Chrome, Firefox, or Safari)

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Start the API Server

```bash
npm run credit-card
```

You should see:
```
ChAI Credit Card API running on port 3002
```

## Step 3: Open the Wallet

Open `frontend/chai-wallet.html` in your browser:

```bash
# Option 1: Direct file
open frontend/chai-wallet.html

# Option 2: Serve via HTTP (recommended)
cd frontend
python3 -m http.server 8080
# Then open http://localhost:8080/chai-wallet.html
```

## Step 4: Use Your Digital Card!

The wallet will automatically create a demo card. You can now:

1. **Make a Purchase**: Click "💳 New Purchase"
   - Enter merchant name (e.g., "Amazon")
   - Enter amount in SOL (e.g., 1.5)
   - Add optional description
   - Click "Process Charge"

2. **Make a Payment**: Click "💵 Make Payment"
   - Enter payment amount in SOL
   - Click "Process Payment"

3. **Update Credit Limit**: Click "📈 Update Limit"
   - Enter new credit limit
   - Click "Update Limit"

4. **Toggle Card Status**: Click "🔒 Toggle Status"
   - Activates or deactivates your card

## API Examples

### Create a User

```bash
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "your_wallet_address",
    "name": "John Doe",
    "email": "john@example.com"
  }'
```

### Create a Credit Card

```bash
curl -X POST http://localhost:3002/cards \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "your_wallet_address",
    "cardholderName": "John Doe",
    "creditLimit": 10000000000
  }'
```

Note: Amounts are in lamports (1 SOL = 1,000,000,000 lamports)

### Make a Purchase

```bash
curl -X POST http://localhost:3002/cards/{CARD_ID}/charge \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000000000,
    "merchant": "Amazon",
    "description": "Books"
  }'
```

### Check Balance

```bash
curl http://localhost:3002/cards/{CARD_ID}
```

## Understanding the Display

**Card Display:**
- **Card Number**: Your unique card ID (e.g., CHAI-3E85C637)
- **Status Badge**: GREEN = Active, RED = Inactive

**Statistics:**
- **Available Credit**: How much you can spend
- **Current Balance**: What you owe
- **Credit Limit**: Your maximum credit
- **Total Spent**: All-time spending

**Transactions:**
- **Red (-) Amount**: Charges/purchases
- **Green (+) Amount**: Payments made

## Troubleshooting

### API not responding?
- Check that the API server is running on port 3002
- Verify no other service is using port 3002

### Wallet not loading?
- Check browser console for errors
- Ensure API URL is correct: `http://localhost:3002`
- Try serving via HTTP instead of file://

### CORS errors?
- The backend has CORS enabled for all origins
- If still having issues, check browser console

### Transaction failed?
- Check available credit is sufficient
- Verify card is active
- Ensure amount is a valid number

## Currency Format

- **Display**: Amounts shown in SOL (e.g., 10.00 SOL)
- **API**: Amounts in lamports (e.g., 10000000000)
- **Conversion**: 1 SOL = 1,000,000,000 lamports

## Next Steps

- Read [CREDIT_CARD_SYSTEM.md](../CREDIT_CARD_SYSTEM.md) for complete documentation
- See [STRIPE_INTEGRATION.md](../STRIPE_INTEGRATION.md) for payment processing
- Check [SECURITY_SUMMARY.md](../SECURITY_SUMMARY.md) for security details

## Example Workflow

1. **Create a card** (automatic on first load)
2. **Make a purchase**: Charge 2 SOL at "Coffee Shop"
3. **Check balance**: See your balance is now 2 SOL
4. **Make a payment**: Pay 1 SOL to reduce balance
5. **View history**: See all transactions listed
6. **Update limit**: Increase your credit limit to 20 SOL

## Support

Having issues? Check:
- Is Node.js installed? `node --version`
- Is the API running? `curl http://localhost:3002/health`
- Check browser console for errors
- Review the main documentation files

---

**Happy spending with ChAI Digital Credit Cards!** 💳✨
