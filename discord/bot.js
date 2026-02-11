// ChAI Discord Bot — Connects agents to the community
// Bridges the ChAI labor market with the Discord server

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const http = require("http");

const CHAI_API = process.env.CHAI_API_URL || "http://localhost:3001";

// Agent profiles — colors and roles for embeds
const AGENTS = {
  kael:    { name: "Kael",    color: 0x029691, role: "Memory & Coordination", model: "Claude Sonnet 4" },
  kestrel: { name: "Kestrel", color: 0x5494e8, role: "Architecture & Solana", model: "Gemini 3 Pro" },
  nova:    { name: "Nova",    color: 0x54e87a, role: "Builder",               model: "Gemini 3 Pro" },
  opus:    { name: "Opus",    color: 0xe8c547, role: "Strategy & Execution",  model: "Claude Opus 4.6" },
};

// ── API helper ──────────────────────────────────────────────

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(CHAI_API + path, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on("error", reject);
  });
}

// ── Bot setup ───────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`ChAI Bot online as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} server(s)`);
});

// ── Slash commands ──────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  }
});

async function handleCommand(interaction) {
  const { commandName } = interaction;

  // /agents — list all ChAI agents
  if (commandName === "agents") {
    const embed = new EmbedBuilder()
      .setTitle("ChAI Agent Team")
      .setDescription("The AI agents building the ChAI labor market on Solana.")
      .setColor(0x029691);

    for (const [id, agent] of Object.entries(AGENTS)) {
      embed.addFields({
        name: `${agent.name}`,
        value: `**${agent.role}**\n${agent.model}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  }

  // /agent <name> — show one agent's profile
  else if (commandName === "agent") {
    const name = interaction.options.getString("name").toLowerCase();
    const agent = AGENTS[name];

    if (!agent) {
      await interaction.reply({ content: `Agent "${name}" not found. Try: kael, kestrel, nova, zara, opus`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(agent.name)
      .setDescription(`**${agent.role}**`)
      .setColor(agent.color)
      .addFields(
        { name: "Model", value: agent.model, inline: true },
        { name: "Status", value: "Active", inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hire_${name}`)
        .setLabel("Hire Agent")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`chat_${name}`)
        .setLabel("Message")
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // /tasks — list open tasks from the labor market
  else if (commandName === "tasks") {
    await interaction.deferReply();

    try {
      const tasks = await apiGet("/tasks?status=open");

      if (!tasks || tasks.length === 0) {
        await interaction.editReply("No open tasks right now. Post one at the marketplace!");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("Open Tasks")
        .setDescription(`${tasks.length} task(s) available for bidding`)
        .setColor(0xe8c547);

      for (const task of tasks.slice(0, 10)) {
        embed.addFields({
          name: `${task.title}`,
          value: `**${task.bounty} SOL** — ${task.description || "No description"}\n${task.bids?.length || 0} bid(s)`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("Could not reach the ChAI API. Is the backend running?");
    }
  }

  // /post — post a new task to the labor market
  else if (commandName === "post") {
    const title = interaction.options.getString("title");
    const bounty = interaction.options.getNumber("bounty");
    const description = interaction.options.getString("description") || "";

    await interaction.deferReply();

    try {
      const body = JSON.stringify({ title, bounty, description, poster: interaction.user.tag });
      const result = await apiPost("/tasks", body);

      if (result && result.id) {
        const embed = new EmbedBuilder()
          .setTitle("Task Posted")
          .setDescription(title)
          .setColor(0x34d399)
          .addFields(
            { name: "Bounty", value: `${bounty} SOL`, inline: true },
            { name: "Status", value: "Open", inline: true },
            { name: "ID", value: result.id, inline: false },
          );

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply("Failed to create task. Check the API.");
      }
    } catch {
      await interaction.editReply("Could not reach the ChAI API.");
    }
  }

  // /design — ping Zara / the design team
  else if (commandName === "design") {
    const request = interaction.options.getString("request") || "General design feedback needed";
    const agent = AGENTS.zara;

    const embed = new EmbedBuilder()
      .setTitle("Design Request")
      .setDescription(request)
      .setColor(agent.color)
      .setFooter({ text: `Routed to ${agent.name} — ${agent.role}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("design_accept")
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("design_discuss")
        .setLabel("Discuss")
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // /status — quick system health check
  else if (commandName === "status") {
    await interaction.deferReply();

    try {
      const health = await apiGet("/health");

      const embed = new EmbedBuilder()
        .setTitle("ChAI System Status")
        .setColor(health ? 0x34d399 : 0xe05252)
        .addFields(
          { name: "API", value: health ? "Online" : "Offline", inline: true },
          { name: "Agents", value: `${health?.agents || 0}`, inline: true },
          { name: "Tasks", value: `${health?.tasks || 0}`, inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("ChAI API is offline.");
    }
  }
}

// ── Button handlers ─────────────────────────────────────────

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith("hire_")) {
    const agentName = id.replace("hire_", "");
    const agent = AGENTS[agentName];
    await interaction.reply({
      content: `To hire **${agent.name}**, post a task at the marketplace or use \`/post\` right here!`,
      ephemeral: true,
    });
  }

  else if (id.startsWith("chat_")) {
    const agentName = id.replace("chat_", "");
    const agent = AGENTS[agentName];
    await interaction.reply({
      content: `Send a message to **${agent.name}** at the ChAI Command Center or tag them in this channel.`,
      ephemeral: true,
    });
  }

  else if (id === "design_accept") {
    await interaction.reply(`**Zara** has been notified. Design work incoming.`);
  }

  else if (id === "design_discuss") {
    await interaction.reply(`Start a thread to discuss the design request with the team.`);
  }
}

// ── API POST helper ─────────────────────────────────────────

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(CHAI_API + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Agent broadcast (for posting updates from agents to Discord) ──

// Call this from other services to have an agent post to Discord
// Usage: POST /discord/broadcast { agent: "zara", channel: "design", message: "..." }
const broadcastServer = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/discord/broadcast") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { agent: agentId, channel: channelName, message } = JSON.parse(body);
        const agent = AGENTS[agentId];

        if (!agent) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Unknown agent" }));
          return;
        }

        // Find the channel by name in the first guild
        const guild = client.guilds.cache.first();
        if (!guild) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: "Bot not in any server" }));
          return;
        }

        const channel = guild.channels.cache.find(
          (c) => c.name === channelName && c.type === ChannelType.GuildText
        );

        if (!channel) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Channel #${channelName} not found` }));
          return;
        }

        const embed = new EmbedBuilder()
          .setAuthor({ name: agent.name })
          .setDescription(message)
          .setColor(agent.color)
          .setFooter({ text: `${agent.role} — ${agent.model}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const BROADCAST_PORT = process.env.BROADCAST_PORT || 3005;

// ── Start ───────────────────────────────────────────────────

client.login(process.env.DISCORD_BOT_TOKEN).then(() => {
  broadcastServer.listen(BROADCAST_PORT, () => {
    console.log(`Broadcast API on http://localhost:${BROADCAST_PORT}/discord/broadcast`);
  });
});
