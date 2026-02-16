import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program;
  const poster = provider.wallet;

  const taskId = "task-001";
  const bountyAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);
  const description = "Build a Solana program";

  let taskEscrowPda: PublicKey;
  let taskEscrowBump: number;

  before(async () => {
    [taskEscrowPda, taskEscrowBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(taskId)],
      program.programId
    );
  });

  it("initializes a task with escrow", async () => {
    const posterBalanceBefore = await provider.connection.getBalance(poster.publicKey);

    await program.methods
      .initializeTask(taskId, bountyAmount, description)
      .accounts({
        poster: poster.publicKey,
        taskEscrow: taskEscrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.taskEscrow.fetch(taskEscrowPda);
    expect(escrow.poster.toBase58()).to.equal(poster.publicKey.toBase58());
    expect(escrow.taskId).to.equal(taskId);
    expect(escrow.description).to.equal(description);
    expect(escrow.bountyAmount.toNumber()).to.equal(bountyAmount.toNumber());
    expect(escrow.status).to.deep.equal({ open: {} });
    expect(escrow.assignedAgent).to.be.null;
    expect(escrow.completedAgent).to.be.null;
    expect(escrow.completedAt).to.be.null;

    const posterBalanceAfter = await provider.connection.getBalance(poster.publicKey);
    expect(posterBalanceBefore - posterBalanceAfter).to.be.greaterThan(bountyAmount.toNumber());
  });

  it("assigns an agent to the task", async () => {
    const agent = Keypair.generate();

    await program.methods
      .assignAgent(agent.publicKey)
      .accounts({
        poster: poster.publicKey,
        taskEscrow: taskEscrowPda,
      })
      .rpc();

    const escrow = await program.account.taskEscrow.fetch(taskEscrowPda);
    expect(escrow.status).to.deep.equal({ inProgress: {} });
    expect(escrow.assignedAgent.toBase58()).to.equal(agent.publicKey.toBase58());
  });

  it("completes a task and pays the agent", async () => {
    const escrowBefore = await program.account.taskEscrow.fetch(taskEscrowPda);
    const agent = escrowBefore.assignedAgent;

    const agentBalanceBefore = await provider.connection.getBalance(agent);

    await program.methods
      .completeTask()
      .accounts({
        poster: poster.publicKey,
        agent: agent,
        taskEscrow: taskEscrowPda,
      })
      .rpc();

    const escrow = await program.account.taskEscrow.fetch(taskEscrowPda);
    expect(escrow.status).to.deep.equal({ completed: {} });
    expect(escrow.completedAgent.toBase58()).to.equal(agent.toBase58());
    expect(escrow.completedAt).to.not.be.null;

    const agentBalanceAfter = await provider.connection.getBalance(agent);
    expect(agentBalanceAfter - agentBalanceBefore).to.equal(bountyAmount.toNumber());
  });

  describe("cancel flow", () => {
    const cancelTaskId = "task-cancel";
    let cancelPda: PublicKey;

    before(async () => {
      [cancelPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(cancelTaskId)],
        program.programId
      );

      await program.methods
        .initializeTask(cancelTaskId, bountyAmount, "Task to cancel")
        .accounts({
          poster: poster.publicKey,
          taskEscrow: cancelPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("cancels a task and refunds the poster", async () => {
      const posterBalanceBefore = await provider.connection.getBalance(poster.publicKey);

      await program.methods
        .cancelTask()
        .accounts({
          poster: poster.publicKey,
          taskEscrow: cancelPda,
        })
        .rpc();

      const posterBalanceAfter = await provider.connection.getBalance(poster.publicKey);
      // Poster gets back bounty + rent (minus tx fee)
      expect(posterBalanceAfter).to.be.greaterThan(posterBalanceBefore);

      // Account should be closed
      const info = await provider.connection.getAccountInfo(cancelPda);
      expect(info).to.be.null;
    });
  });

  describe("error cases", () => {
    const errTaskId = "task-err";
    let errPda: PublicKey;
    const unauthorizedUser = Keypair.generate();

    before(async () => {
      [errPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(errTaskId)],
        program.programId
      );

      await program.methods
        .initializeTask(errTaskId, bountyAmount, "Task for error tests")
        .accounts({
          poster: poster.publicKey,
          taskEscrow: errPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fund the unauthorized user so they can pay tx fees
      const sig = await provider.connection.requestAirdrop(
        unauthorizedUser.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    });

    it("rejects assign from non-poster", async () => {
      const agent = Keypair.generate();

      try {
        await program.methods
          .assignAgent(agent.publicKey)
          .accounts({
            poster: unauthorizedUser.publicKey,
            taskEscrow: errPda,
          })
          .signers([unauthorizedUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("Unauthorized");
      }
    });

    it("rejects cancel on a completed task", async () => {
      // First complete the task
      const agent = Keypair.generate();

      await program.methods
        .assignAgent(agent.publicKey)
        .accounts({
          poster: poster.publicKey,
          taskEscrow: errPda,
        })
        .rpc();

      await program.methods
        .completeTask()
        .accounts({
          poster: poster.publicKey,
          agent: agent.publicKey,
          taskEscrow: errPda,
        })
        .rpc();

      try {
        await program.methods
          .cancelTask()
          .accounts({
            poster: poster.publicKey,
            taskEscrow: errPda,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("TaskAlreadyCompleted");
      }
    });

    it("rejects complete with wrong agent", async () => {
      const taskId2 = "task-wrong-agent";
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(taskId2)],
        program.programId
      );

      const correctAgent = Keypair.generate();
      const wrongAgent = Keypair.generate();

      await program.methods
        .initializeTask(taskId2, bountyAmount, "Wrong agent test")
        .accounts({
          poster: poster.publicKey,
          taskEscrow: pda2,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .assignAgent(correctAgent.publicKey)
        .accounts({
          poster: poster.publicKey,
          taskEscrow: pda2,
        })
        .rpc();

      try {
        await program.methods
          .completeTask()
          .accounts({
            poster: poster.publicKey,
            agent: wrongAgent.publicKey,
            taskEscrow: pda2,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("WrongAgent");
      }
    });
  });
});
