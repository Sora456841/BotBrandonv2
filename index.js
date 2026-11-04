require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const express = require('express');

// --- MINI SERVEUR WEB POUR UPTIMEROBOT ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Le bot est en ligne et fonctionnel !');
});

app.listen(PORT, () => {
    console.log(`Serveur Web lancé sur le port ${PORT}`);
});
// ----------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers // Requis pour gérer les rôles des membres
    ]
});

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);

    const commands = [
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Crée un classement personnalisé avec skin Roblox.')
            .addChannelOption(option => 
                option.setName('salon').setDescription('Le salon où envoyer le leaderboard').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addStringOption(option => option.setName('top1_nom').setDescription('Nom du joueur #1').setRequired(true))
            .addStringOption(option => option.setName('top1_mention').setDescription('Mention Discord du #1 (ex: @BTedd)').setRequired(true))
            .addStringOption(option => option.setName('top1_roblox').setDescription('Nom Roblox du #1').setRequired(true))
            .addStringOption(option => option.setName('top1_style').setDescription('Style du joueur (ex: MDon)').setRequired(true))
            .addStringOption(option => option.setName('top1_rank').setDescription('Rang du joueur (ex: Tier 2 High)').setRequired(true))
            .addStringOption(option => option.setName('top1_avatar_url').setDescription('Lien direct de l\'image du skin Roblox').setRequired(true)),

        new SlashCommandBuilder()
            .setName('pingrole')
            .setDescription('Envoie un message avec un rôle mentionné dans un salon.')
            .addChannelOption(option => 
                option.setName('salon').setDescription('Le salon où envoyer le ping').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addRoleOption(option => option.setName('role').setDescription('Le rôle à mentionner').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message optionnel').setRequired(false)),

        // --- NOUVELLE COMMANDE : /addrole ---
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

    const authorizedUsers = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [];

    if (!authorizedUsers.includes(interaction.user.id)) {
        return await interaction.reply({ 
            content: "B-bêta ! Tu n'as pas l'autorisation d'utiliser cette commande !", 
            ephemeral: true 
        });
    }

    if (interaction.commandName === 'leaderboard') {
        const salon = interaction.options.getChannel('salon');
        const nom = interaction.options.getString('top1_nom');
        const mention = interaction.options.getString('top1_mention');
        const roblox = interaction.options.getString('top1_roblox');
        const style = interaction.options.getString('top1_style');
        const rank = interaction.options.getString('top1_rank');
        const avatarUrl = interaction.options.getString('top1_avatar_url');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Classement - TOP-DEFENDER')
            .setColor(0x2f3136)
            .addFields(
                { name: `#1 ${nom}`, value: `| ${mention} |\n| ${roblox} |\nStyle: ${style}\nRank: ${rank}\n` + '—'.repeat(20), inline: false }
            )
            .setThumbnail(avatarUrl);

        for (let i = 2; i <= 5; i++) {
            embed.addFields(
                { name: `#${i} Vacant`, value: `| Vacant |\n| Vacant. |\nStyle: -\nRank: -\n` + '—'.repeat(20), inline: false }
            );
        }

        await salon.send({ embeds: [embed] });
        await interaction.reply({ content: `Le leaderboard a été publié dans ${salon} !`, ephemeral: true });
    } 
    
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