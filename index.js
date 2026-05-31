require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PREFIX = "?";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// ================= DATABASE =================
const dbFile = "./db.json";

let db = {
  automod: {
    enabled: true,
    badwords: []
  },
  verification: {
    enabled: false,
    type: "captcha"
  }
};

if (fs.existsSync(dbFile)) {
  db = JSON.parse(fs.readFileSync(dbFile));
}

function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// ================= SLASH COMMANDS =================
const slashCommands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Bot status"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Help menu"),

  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage automod")
    .addSubcommand(s =>
      s.setName("enable").setDescription("Enable automod")
    )
    .addSubcommand(s =>
      s.setName("disable").setDescription("Disable automod")
    )
    .addSubcommand(s =>
      s.setName("badword_add")
        .setDescription("Add badword")
        .addStringOption(o =>
          o.setName("word")
            .setDescription("Bad word")
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("verification")
    .setDescription("Verification system")
    .addSubcommand(s =>
      s.setName("enable")
        .setDescription("Enable verification")
        .addStringOption(o =>
          o.setName("type")
            .setDescription("captcha or button")
            .setRequired(true)
            .addChoices(
              { name: "captcha", value: "captcha" },
              { name: "button", value: "button" }
            )
        )
    )
    .addSubcommand(s =>
      s.setName("disable")
        .setDescription("Disable verification")
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: slashCommands }
    );
    console.log("Slash commands loaded.");
  } catch (err) {
    console.log("Slash command error:", err);
  }
});

// ================= READY =================
client.once("ready", () => {
  console.log(`${client.user.tag} is online`);

  client.user.setActivity("dsc.gg/bluestar", {
    type: 3 // Watching
  });
});

// ================= HELP =================
function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("Help Panel")
    .setColor("Blue")
    .setDescription(`
**Prefix:** ${PREFIX}

Commands:
- ${PREFIX}ping
- ${PREFIX}status
- ${PREFIX}help

Slash:
/automod
/verification
/ping
/status
`);
}

// ================= MESSAGE CREATE =================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // AUTO REACT
  const trigger = ["itzhuztro", `<@${client.user.id}>`];
  if (trigger.some(t => message.content.toLowerCase().includes(t))) {
    await message.react("👑").catch(() => {});
  }

  // AUTOMOD
  if (db.automod.enabled) {
    const bad = db.automod.badwords;
    if (bad.some(w => message.content.toLowerCase().includes(w))) {
      await message.delete().catch(() => {});
      return message.channel.send(`${message.author}, bad word not allowed!`);
    }
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "ping") return message.reply(`🏓 Pong: ${client.ws.ping}ms`);

  if (cmd === "status") return message.reply("🟢 Bot is online and secure.");

  if (cmd === "help") return message.reply({ embeds: [helpEmbed()] });

  if (cmd === "automod-enable") {
    db.automod.enabled = true;
    saveDB();
    return message.reply("✅ Automod enabled");
  }

  if (cmd === "automod-disable") {
    db.automod.enabled = false;
    saveDB();
    return message.reply("❌ Automod disabled");
  }

  if (cmd === "badword-add") {
    const word = args[0];
    if (!word) return message.reply("Provide a word");

    db.automod.badwords.push(word.toLowerCase());
    saveDB();
    return message.reply(`Added badword: ${word}`);
  }
});

// ================= VERIFICATION =================
client.on("guildMemberAdd", async (member) => {
  if (!db.verification.enabled) return;

  const channel = member.guild.systemChannel;
  if (!channel) return;

  if (db.verification.type === "button") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify")
        .setLabel("Verify Me")
        .setStyle(ButtonStyle.Success)
    );

    channel.send({
      content: `${member}, click to verify`,
      components: [row]
    });
  } else {
    channel.send(`${member}, type: I AM HUMAN to verify`);
  }
});

// ================= BUTTON =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "verify") {
    const role = interaction.guild.roles.cache.find(r => r.name === "Verified");
    if (role) await interaction.member.roles.add(role);

    return interaction.reply({
      content: "✅ Verified successfully",
      ephemeral: true
    });
  }
});

// ================= SLASH HANDLER =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    return interaction.reply(`🏓 Pong: ${client.ws.ping}ms`);
  }

  if (commandName === "status") {
    return interaction.reply("🟢 Bot running perfectly");
  }

  if (commandName === "help") {
    return interaction.reply({ embeds: [helpEmbed()] });
  }

  if (commandName === "automod") {
    const sub = interaction.options.getSubcommand();

    if (sub === "enable") {
      db.automod.enabled = true;
      saveDB();
      return interaction.reply("Automod enabled");
    }

    if (sub === "disable") {
      db.automod.enabled = false;
      saveDB();
      return interaction.reply("Automod disabled");
    }

    if (sub === "badword_add") {
      const word = interaction.options.getString("word");
      if (!word) return;

      db.automod.badwords.push(word.toLowerCase());
      saveDB();
      return interaction.reply(`Added badword: ${word}`);
    }
  }

  if (commandName === "verification") {
    const sub = interaction.options.getSubcommand();

    if (sub === "enable") {
      db.verification.enabled = true;
      db.verification.type = interaction.options.getString("type");
      saveDB();
      return interaction.reply("Verification enabled");
    }

    if (sub === "disable") {
      db.verification.enabled = false;
      saveDB();
      return interaction.reply("Verification disabled");
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
