import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<any>;
  const poster = provider.wallet as anchor.Wallet;
  const agent = anchor.web3.Keypair.generate();

  const TASK_ID = "task-001";

  let taskEscrowPda: PublicKey;
  let taskEscrowBump: number;

  before(async () => {
    [taskEscrowPda, taskEscrowBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("task"),
        poster.publicKey.toBuffer(),
        Buffer.from(TASK_ID),
      ],
      program.programId
    );

    // Airdrop to agent for account existence
    const sig = await provider.connection.requestAirdrop(
      agent.publicKey,
      0.1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("initializes a task with bounty", async () => {
    const bounty = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    await program.methods
      .initializeTask(TASK_ID, bounty, "Build a Solana oracle integration")
      .accounts({
        poster: poster.publicKey,
        taskEscrow: taskEscrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const task = await program.account.taskEscrow.fetch(taskEscrowPda);
    assert.equal(task.taskId, TASK_ID);
    assert.equal(task.bountyAmount.toNumber(), bounty.toNumber());
    assert.deepEqual(task.status, { open: {} });
    assert.equal(task.poster.toBase58(), poster.publicKey.toBase58());
  });

  it("assigns an agent to the task", async () => {
    await program.methods
      .assignAgent(agent.publicKey)
      .accounts({
        poster: poster.publicKey,
        taskEscrow: taskEscrowPda,
      })
      .rpc();

    const task = await program.account.taskEscrow.fetch(taskEscrowPda);
    assert.deepEqual(task.status, { inProgress: {} });
    assert.equal(task.assignedAgent.toBase58(), agent.publicKey.toBase58());
  });

  it("completes the task and pays the agent", async () => {
    const agentBalanceBefore = await provider.connection.getBalance(agent.publicKey);

    await program.methods
      .completeTask()
      .accounts({
        poster: poster.publicKey,
        agent: agent.publicKey,
        taskEscrow: taskEscrowPda,
      })
      .rpc();

    const task = await program.account.taskEscrow.fetch(taskEscrowPda);
    assert.deepEqual(task.status, { completed: {} });
    assert.equal(task.completedAgent.toBase58(), agent.publicKey.toBase58());

    const agentBalanceAfter = await provider.connection.getBalance(agent.publicKey);
    assert.isAbove(agentBalanceAfter, agentBalanceBefore, "Agent should have received bounty");
  });

  it("allows poster to cancel an open task and get refund", async () => {
    const CANCEL_TASK_ID = "task-cancel";
    const [cancelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(CANCEL_TASK_ID)],
      program.programId
    );

    const bounty = new anchor.BN(0.2 * LAMPORTS_PER_SOL);
    await program.methods
      .initializeTask(CANCEL_TASK_ID, bounty, "Task to be cancelled")
      .accounts({
        poster: poster.publicKey,
        taskEscrow: cancelPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const posterBalanceBefore = await provider.connection.getBalance(poster.publicKey);

    await program.methods
      .cancelTask()
      .accounts({
        poster: poster.publicKey,
        taskEscrow: cancelPda,
      })
      .rpc();

    const posterBalanceAfter = await provider.connection.getBalance(poster.publicKey);
    assert.isAbove(posterBalanceAfter, posterBalanceBefore, "Poster should get refund on cancel");
  });

  it("rejects completing a task with wrong agent", async () => {
    const WRONG_TASK_ID = "task-wrong";
    const [wrongPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("task"), poster.publicKey.toBuffer(), Buffer.from(WRONG_TASK_ID)],
      program.programId
    );
    const wrongAgent = anchor.web3.Keypair.generate();

    const bounty = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    await program.methods
      .initializeTask(WRONG_TASK_ID, bounty, "Wrong agent test")
      .accounts({
        poster: poster.publicKey,
        taskEscrow: wrongPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .assignAgent(agent.publicKey)
      .accounts({ poster: poster.publicKey, taskEscrow: wrongPda })
      .rpc();

    try {
      await program.methods
        .completeTask()
        .accounts({
          poster: poster.publicKey,
          agent: wrongAgent.publicKey,
          taskEscrow: wrongPda,
        })
        .rpc();
      assert.fail("Should have thrown WrongAgent error");
    } catch (e: any) {
      assert.include(e.message, "WrongAgent");
    }
  });
});
