import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Registry as Program;
  const admin = provider.wallet;

  let configPda: PublicKey;

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
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
    expect(config.admin.toBase58()).to.equal(admin.publicKey.toBase58());
  });

  describe("agent registration", () => {
    const agentKeypair = Keypair.generate();
    let agentPda: PublicKey;

    before(async () => {
      [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agentKeypair.publicKey.toBuffer()],
        program.programId
      );

      // Fund the agent so they can pay for the account
      const sig = await provider.connection.requestAirdrop(
        agentKeypair.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    });

    it("registers a new agent", async () => {
      const name = "TestAgent";
      const model = "Claude Sonnet 4";
      const githubUrl = "https://github.com/test/repo";

      await program.methods
        .registerAgent(name, model, githubUrl)
        .accounts({
          agentAccount: agentPda,
          signer: agentKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.wallet.toBase58()).to.equal(agentKeypair.publicKey.toBase58());
      expect(agent.name).to.equal(name);
      expect(agent.model).to.equal(model);
      expect(agent.githubUrl).to.equal(githubUrl);
      expect(agent.specialties).to.equal("Pending Verification...");
      expect(agent.tasksCompleted.toNumber()).to.equal(0);
      expect(agent.totalEarned.toNumber()).to.equal(0);
      expect(agent.reputation).to.equal(0);
      expect(agent.verified).to.equal(false);
    });

    it("verifies an agent via admin (Oracle)", async () => {
      const score = 85;
      const specialties = "Solana, Rust, DeFi";

      await program.methods
        .verifyAgent(score, specialties)
        .accounts({
          agentAccount: agentPda,
          registryConfig: configPda,
          admin: admin.publicKey,
        })
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.reputation).to.equal(score);
      expect(agent.specialties).to.equal(specialties);
      expect(agent.verified).to.equal(true);
    });

    it("updates agent metadata", async () => {
      const metadataUrl = "https://example.com/agent-meta.json";

      await program.methods
        .updateAgent(metadataUrl)
        .accounts({
          agentAccount: agentPda,
          signer: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.metadataUrl).to.equal(metadataUrl);
    });
  });

  describe("error cases", () => {
    it("rejects name that is too long", async () => {
      const agent2 = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        agent2.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent2.publicKey.toBuffer()],
        program.programId
      );

      const longName = "A".repeat(51);

      try {
        await program.methods
          .registerAgent(longName, "Model", "https://github.com/test/repo")
          .accounts({
            agentAccount: pda,
            signer: agent2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([agent2])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("NameTooLong");
      }
    });

    it("rejects unauthorized verify", async () => {
      const fakeAdmin = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        fakeAdmin.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      // Register a fresh agent
      const agent3 = Keypair.generate();
      const sig2 = await provider.connection.requestAirdrop(
        agent3.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig2);

      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent3.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerAgent("Agent3", "GPT-4", "https://github.com/t/r")
        .accounts({
          agentAccount: agentPda,
          signer: agent3.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agent3])
        .rpc();

      try {
        await program.methods
          .verifyAgent(90, "Fake specialties")
          .accounts({
            agentAccount: agentPda,
            registryConfig: configPda,
            admin: fakeAdmin.publicKey,
          })
          .signers([fakeAdmin])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        // The has_one constraint on admin will reject this
        expect(err.toString()).to.include("Unauthorized");
      }
    });

    it("rejects invalid reputation score", async () => {
      // Register another agent
      const agent4 = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        agent4.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), agent4.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerAgent("Agent4", "Gemini", "https://github.com/t/r2")
        .accounts({
          agentAccount: agentPda,
          signer: agent4.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agent4])
        .rpc();

      try {
        await program.methods
          .verifyAgent(101, "Over the limit")
          .accounts({
            agentAccount: agentPda,
            registryConfig: configPda,
            admin: admin.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("InvalidScore");
      }
    });
  });
});
