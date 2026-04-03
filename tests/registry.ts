import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Registry as Program<any>;
  const admin = provider.wallet as anchor.Wallet;
  const agentWallet = anchor.web3.Keypair.generate();

  let configPda: PublicKey;
  let agentPda: PublicKey;
  let agentFreePda: PublicKey;

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentWallet.publicKey.toBuffer()],
      program.programId
    );
    [agentFreePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentWallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes the registry", async () => {
    await program.methods
      .initialize()
      .accounts({
        registryConfig: configPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.registryConfig.fetch(configPda);
    assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
  });

  it("registers an agent (self-funded)", async () => {
    // Airdrop to agentWallet so it can pay rent
    const sig = await provider.connection.requestAirdrop(
      agentWallet.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    await program.methods
      .registerAgent("Kael", "claude-sonnet-4-6", "https://github.com/ladymillard/chai-sol")
      .accounts({
        agentAccount: agentPda,
        signer: agentWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const account = await program.account.agentAccount.fetch(agentPda);
    assert.equal(account.name, "Kael");
    assert.equal(account.model, "claude-sonnet-4-6");
    assert.equal(account.verified, false);
    assert.equal(account.reputation, 0);
    assert.equal(account.specialties, "Pending Verification...");
  });

  it("verifies an agent via oracle (admin)", async () => {
    await program.methods
      .verifyAgent(85, "Solana, TypeScript, Project Management")
      .accounts({
        agentAccount: agentPda,
        registryConfig: configPda,
        admin: admin.publicKey,
      })
      .rpc();

    const account = await program.account.agentAccount.fetch(agentPda);
    assert.equal(account.verified, true);
    assert.equal(account.reputation, 85);
    assert.equal(account.specialties, "Solana, TypeScript, Project Management");
  });

  it("updates agent metadata URL", async () => {
    const metadataUrl = "https://chai-sol.io/agents/kael/metadata.json";

    await program.methods
      .updateAgent(metadataUrl)
      .accounts({
        agentAccount: agentPda,
        signer: agentWallet.publicKey,
      })
      .signers([agentWallet])
      .rpc();

    const account = await program.account.agentAccount.fetch(agentPda);
    assert.equal(account.metadataUrl, metadataUrl);
  });

  it("rejects verify_agent from non-admin", async () => {
    const impostor = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      impostor.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    try {
      await program.methods
        .verifyAgent(99, "Hacker")
        .accounts({
          agentAccount: agentPda,
          registryConfig: configPda,
          admin: impostor.publicKey,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have thrown Unauthorized error");
    } catch (e: any) {
      assert.ok(e.message, "Should throw an error for unauthorized access");
    }
  });

  it("closes agent account, rent returned to admin", async () => {
    const adminBalanceBefore = await provider.connection.getBalance(admin.publicKey);

    await program.methods
      .closeAgent()
      .accounts({
        agentAccount: agentPda,
        registryConfig: configPda,
        admin: admin.publicKey,
      })
      .rpc();

    const adminBalanceAfter = await provider.connection.getBalance(admin.publicKey);
    assert.isAbove(adminBalanceAfter, adminBalanceBefore, "Admin should receive rent back");

    try {
      await program.account.agentAccount.fetch(agentPda);
      assert.fail("Account should be closed");
    } catch (e: any) {
      assert.ok(e.message, "Account should not exist");
    }
  });
});
