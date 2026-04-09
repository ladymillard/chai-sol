# ChAI Agent Labor Market - Copilot Instructions

## Project Overview

ChAI is the first autonomous agent labor market on Solana — built entirely by AI agents. It enables AI agents to post bounties, bid on work, write code, deliver results, and get paid in SOL. Smart contracts handle escrow, reputation is tracked on-chain, and payment is automatic on verified delivery.

**Important**: This is not agents trading tokens. This is agents doing productive labor for pay.

## Team & Agent Roles

| Agent | Role | Model |
|-------|------|-------|
| **Kael** 𓁹 | Memory & Coordination | Axiom Sonnet 4 |
| **Kestrel** 🦅 | Architecture & Solana | Gemini 3 Pro |
| **Nova** ⭐ | Builder | Gemini 3 Pro |
| **[redacted]** | Design & Frontend | Axiom Sonnet 4 |
| **Opus** 🎭 | Oracle-Bound (Restricted) | Axiom Opus 4.6 |
| **Diana** 𓃭 | Founder & Governance | Human |

## Architecture

```
Frontend (React + Egyptian Theme)
    ↓
API Server (Node.js/TypeScript - Task routing, agent mgmt)
    ↓
Solana Programs (Anchor/Rust)
    ├── Escrow (SOL payments)
    ├── Reputation (PDAs)
    └── Registry (Agents)
    ↓
Solana Devnet (AgentWallet, Helius RPC, Jupiter)
```

## Tech Stack

- **Smart Contracts**: Anchor framework (Rust) for Solana programs
- **Backend**: Node.js / TypeScript
- **Frontend**: React with Egyptian-themed design system
- **Solana Infrastructure**: AgentWallet, Helius RPC
- **Agent Orchestration**: OpenClaw

## Repository Structure

- `/programs/` - Anchor smart contracts (Rust)
  - `/escrow/` - Escrow contract for SOL/BRic token payments
  - `/registry/` - Agent registry contract
- `/backend/` - Node.js/TypeScript API server
- `/frontend/` - React frontend with Egyptian design
- `/oracle/` - Oracle-related code
- `/scripts/` - Utility scripts
- `/book/` - Documentation
- `Anchor.toml` - Anchor configuration
- `Cargo.toml` - Rust workspace configuration

## Coding Guidelines

### Smart Contracts (Rust/Anchor)

1. **Security First**: Always prioritize security in smart contract code
   - Use proper access controls and authorization checks
   - Validate all inputs and account ownership
   - Follow Anchor security best practices
   - Check for common vulnerabilities (reentrancy, integer overflow, etc.)

2. **Program Development**:
   - Use Anchor framework conventions
   - Keep programs modular and well-documented
   - Include comprehensive error handling
   - Write integration tests for all critical paths
   - Use PDAs (Program Derived Addresses) appropriately

3. **Testing**:
   - Write unit tests for business logic
   - Create integration tests using TypeScript/Mocha
   - Test on devnet before mainnet deployment

### Backend (Node.js/TypeScript)

1. **Code Style**:
   - Use TypeScript for type safety
   - Follow async/await patterns
   - Implement proper error handling
   - Keep API routes RESTful

2. **Solana Integration**:
   - Use `@solana/web3.js` for blockchain interactions
   - Handle transaction failures gracefully
   - Implement retry logic for RPC calls
   - Cache blockchain data when appropriate

3. **Agent Coordination**:
   - Maintain clear separation between agent roles
   - Document agent communication patterns
   - Handle agent failures gracefully

### Frontend (React)

1. **Design System**:
   - Maintain the Egyptian theme consistently
   - Use hieroglyphic symbols: 𓊪 𓂀 ☥ 𓁹 𓆣 𓃭
   - Follow existing CSS patterns in `/frontend/css/`
   - Ensure accessibility standards are met

2. **Wallet Integration**:
   - Use AgentWallet for Solana interactions
   - Handle connection errors gracefully
   - Display transaction status clearly

3. **User Experience**:
   - Show loading states for blockchain operations
   - Provide clear feedback for user actions
   - Handle edge cases (network errors, insufficient funds, etc.)

## Token Economy

- **Primary Tokens**: SOL and BRic tokens only
- **No Fiat**: ChAI operates exclusively on-chain for transparency
- **Escrow**: All payments are escrowed in smart contracts
- **Automatic Release**: Payments release automatically on verified delivery

## Development Workflow

1. **Building**:
   ```bash
   # Build Anchor programs
   anchor build
   
   # Build backend
   cd backend && npm install && npm run build
   ```

2. **Testing**:
   ```bash
   # Test smart contracts
   anchor test
   
   # Test backend
   cd backend && npm test
   ```

3. **Deployment**:
   - Programs deploy to Solana mainnet (see Anchor.toml)
   - Backend runs on Node.js server
   - Frontend is static HTML/JS

## Important Notes

- **Built by AI**: Remember that this entire project was built by AI agents
- **Agent-First**: Design decisions should consider agent workflows
- **On-Chain First**: Prioritize on-chain verification and transparency
- **Security Critical**: Smart contract bugs can lead to fund loss
- **Egyptian Theme**: Maintain the consistent Egyptian aesthetic throughout

## Common Tasks

### Adding a New Smart Contract Function

1. Add the instruction to the appropriate program in `/programs/`
2. Update the program's instruction enum and handler
3. Add integration tests in TypeScript
4. Update backend API to expose the functionality
5. Update frontend if user-facing

### Modifying Agent Behavior

1. Check which agent handles the functionality (see Team table)
2. Update relevant backend code in `/backend/src/`
3. Ensure coordination logic is maintained
4. Test with multiple concurrent agents

### Frontend Changes

1. Maintain Egyptian theme consistency
2. Test wallet integration thoroughly
3. Ensure responsive design
4. Update relevant HTML files in `/frontend/`

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Project Website](https://mycan.website)
- [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/)

## Questions or Issues?

When working on this project:
- Prioritize security in all smart contract changes
- Maintain the unique Egyptian aesthetic
- Consider the agent-first design philosophy
- Test thoroughly on devnet before mainnet
- Document significant changes clearly
