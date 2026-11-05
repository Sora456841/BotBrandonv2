require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const express = require('express');
const fs = require('fs');

const DB_FILE = './leaderboard_db.json';

// Initialisation de la base de données locale si elle n'existe pas
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ forwards: [], defenders: [], gks: [] }, null, 2));
}

function getDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- MINI SERVEUR WEB POUR UPTIMEROBOT ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Le bot Top-Defender est en ligne et fonctionnel !');
});

app.listen(PORT, () => {
    console.log(`Serveur Web lancé sur le port ${PORT}`);
});
// ----------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);

    const commands = [
        // --- COMMANDE 1 : GESTION DES LEADERBOARDS (Forwards, Défenseurs & GKs) ---
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Affiche le classement des Forwards, Défenseurs ou Gardiens.')
            .addChannelOption(option => 
                option.setName('salon').setDescription('Le salon où envoyer le leaderboard').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addStringOption(option => 
                option.setName('categorie')
                    .setDescription('Choisis la catégorie du classement')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Forwards (Attaquants)', value: 'forwards' },
                        { name: 'Défenseurs', value: 'defenders' },
                        { name: 'GKs (Gardiens)', value: 'gks' }
                    )),

        // --- COMMANDE 2 : AJOUTER/MODIFIER UN JOUEUR À N'IMPORTE QUELLE PLACE ---
        new SlashCommandBuilder()
            .setName('set-player')
            .setDescription('Ajoute ou modifie un joueur à une place spécifique dans un leaderboard.')
            .addStringOption(option => 
                option.setName('categorie')
                    .setDescription('La catégorie')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Forwards', value: 'forwards' },
                        { name: 'Défenseurs', value: 'defenders' },
                        { name: 'GKs (Gardiens)', value: 'gks' }
                    ))
            .addIntegerOption(option => 
                option.setName('position')
                    .setDescription('La place dans le classement (de 1 à 5)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(5))
            .addStringOption(option => option.setName('nom').setDescription('Nom affiché du joueur').setRequired(true))
            .addStringOption(option => option.setName('mention').setDescription('Mention Discord (ex: @pseudo)').setRequired(true))
            .addStringOption(option => option.setName('roblox').setDescription('Nom Roblox').setRequired(true))
            .addStringOption(option => option.setName('style').setDescription('Style du joueur (ex: MDon)').setRequired(true))
            .addStringOption(option => option.setName('rank').setDescription('Rang (ex: Tier 2 High)').setRequired(true))
            .addStringOption(option => option.setName('avatar_url').setDescription('Lien direct de l\'avatar Roblox').setRequired(true)),

        // --- COMMANDE 3 : PING RÔLE ---
        new SlashCommandBuilder()
            .setName('pingrole')
            .setDescription('Envoie un message avec un rôle mentionné dans un salon.')
            .addChannelOption(option => 
                option.setName('salon').setDescription('Le salon où envoyer le ping').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addRoleOption(option => option.setName('role').setDescription('Le rôle à mentionner').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message optionnel').setRequired(false)),

        // --- COMMANDE 4 : ADD ROLE ---
        new SlashCommandBuilder()
            .setName('addrole')
            .setDescription('Donne un rôle à un utilisateur.')
            .addUserOption(option => option.setName('membre').setDescription('Le membre à qui donner le rôle').setRequired(true))
            .addRoleOption(option => option.setName('role').setDescription('Le rôle à attribuer').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Actualisation des commandes slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Commandes slash enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Vérification de la liste des utilisateurs autorisés dans .env
    const authorizedUsers = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [];

    if (!authorizedUsers.includes(interaction.user.id)) {
        return await interaction.reply({ 
            content: "B-bêta ! Tu n'as pas l'autorisation d'utiliser cette commande !", 
            ephemeral: true 
        });
    }

    const db = getDb();

    // --- GESTION DE LA COMMANDE /set-player ---
    if (interaction.commandName === 'set-player') {
        const categorie = interaction.options.getString('categorie');
        const position = interaction.options.getInteger('position') - 1; // Index 0 à 4
        
        const playerData = {
            nom: interaction.options.getString('nom'),
            mention: interaction.options.getString('mention'),
            roblox: interaction.options.getString('roblox'),
            style: interaction.options.getString('style'),
            rank: interaction.options.getString('rank'),
            avatarUrl: interaction.options.getString('avatar_url')
        };

        if (!db[categorie]) db[categorie] = [];

        while (db[categorie].length <= position) {
            db[categorie].push(null);
        }

        db[categorie][position] = playerData;
        saveDb(db);

        return await interaction.reply({ 
            content: `✅ Le joueur **${playerData.nom}** a été placé à la position **#${position + 1}** dans la catégorie **${categorie.toUpperCase()}** !`, 
            ephemeral: true 
        });
    }

    // --- GESTION DE LA COMMANDE /leaderboard ---
    else if (interaction.commandName === 'leaderboard') {
        const salon = interaction.options.getChannel('salon');
        const categorie = interaction.options.getString('categorie');
        const players = db[categorie] || [];

        // Choix de la couleur selon la catégorie
        let embedColor = 0xE74C3C; // Rouge pour Forwards
        if (categorie === 'defenders') embedColor = 0x3498DB; // Bleu pour Défenseurs
        if (categorie === 'gks') embedColor = 0x2ECC71; // Vert pour GKs

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Classement - ${categorie.toUpperCase()}`)
            .setColor(embedColor);

        for (let i = 0; i < 5; i++) {
            const player = players[i];
            const rankNum = i + 1;

            if (player) {
                embed.addFields({ 
                    name: `#${rankNum} ${player.nom}`, 
                    value: `| ${player.mention} |\n| ${player.roblox} |\nStyle: ${player.style}\nRank: ${player.rank}\n` + '—'.repeat(20), 
                    inline: false 
                });
                if (i === 0 && player.avatarUrl) {
                    embed.setThumbnail(player.avatarUrl);
                }
            } else {
                embed.addFields({ 
                    name: `#${rankNum} Vacant`, 
                    value: `| Vacant |\n| Vacant. |\nStyle: -\nRank: -\n` + '—'.repeat(20), 
                    inline: false 
                });
            }
        }

        await salon.send({ embeds: [embed] });
        await interaction.reply({ content: `Le leaderboard des **${categorie.toUpperCase()}** a été publié dans ${salon} !`, ephemeral: true });
    } 

    // --- GESTION DE LA COMMANDE /pingrole ---
    else if (interaction.commandName === 'pingrole') {
        const salon = interaction.options.getChannel('salon');
        const role = interaction.options.getRole('role');
        const message = interaction.options.getString('message') || 'Nouvelle annonce !';

        await salon.send(`${role}\n${message}`);
        await interaction.reply({ content: `Le ping a bien été envoyé dans ${salon} !`, ephemeral: true });
    }

    // --- GESTION DE LA COMMANDE /addrole ---
    else if (interaction.commandName === 'addrole') {
        const member = interaction.options.getMember('membre');
        const role = interaction.options.getRole('role');

        if (!member) {
            return await interaction.reply({ content: "Membre introuvable sur le serveur.", ephemeral: true });
        }

        try {
            await member.roles.add(role);
            await interaction.reply({ content: `Le rôle **${role.name}** a été ajouté avec succès à ${member} !`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "Impossible d'attribuer ce rôle. Vérifie que mon rôle de bot est bien placé au-dessus du rôle à attribuer dans la hiérarchie du serveur.", ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);