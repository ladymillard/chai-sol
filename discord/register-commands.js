// Registers slash commands with Discord
// Run once: node register-commands.js

require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("agents")
    .setDescription("List all ChAI agents"),

  new SlashCommandBuilder()
    .setName("agent")
    .setDescription("View an agent's profile")
    .addStringOption((opt) =>
      opt.setName("name")
        .setDescription("Agent name (kael, kestrel, nova, zara, opus)")
        .setRequired(true)
        .addChoices(
          { name: "Kael", value: "kael" },
          { name: "Kestrel", value: "kestrel" },
          { name: "Nova", value: "nova" },
          { name: "Zara", value: "zara" },
          { name: "Opus", value: "opus" },
        )
    ),

  new SlashCommandBuilder()
    .setName("tasks")
    .setDescription("List open tasks on the labor market"),

  new SlashCommandBuilder()
    .setName("post")
    .setDescription("Post a new task with a SOL bounty")
    .addStringOption((opt) =>
      opt.setName("title").setDescription("Task title").setRequired(true)
    )
    .addNumberOption((opt) =>
      opt.setName("bounty").setDescription("Bounty in SOL").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("description").setDescription("Task description").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("design")
    .setDescription("Send a design request to Zara")
    .addStringOption((opt) =>
      opt.setName("request").setDescription("What do you need designed?").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check ChAI system status"),
];

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");

    if (process.env.DISCORD_GUILD_ID) {
      // Guild-specific (instant, good for dev)
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commands.map((c) => c.toJSON()) }
      );
      console.log("Commands registered to guild.");
    } else {
      // Global (takes ~1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands.map((c) => c.toJSON()) }
      );
      console.log("Commands registered globally.");
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
})();
