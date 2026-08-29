'use strict';

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  Events,
  ActivityType
} = require('discord.js');

const COLORS = {
  info: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  danger: 0xED4245,
  cash: 0xE67E22,
  stock: 0x3498DB,
  team: 0x9B59B6,
  admin: 0x95A5A6
};

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function boolEnv(name, fallback=false) {
  const value = env(name);
  return value ? ['1','true','yes','oui','on'].includes(value.toLowerCase()) : fallback;
}
function splitIds(value) { return String(value || '').split(/[;,\s]+/).map(v=>v.trim()).filter(Boolean); }
function arr(v){ return Array.isArray(v) ? v : []; }
function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function truncate(value, max=1000){
  const text=String(value ?? '');
  return text.length<=max?text:text.slice(0,Math.max(0,max-1))+'…';
}
function peso(value){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(n(value)); }
function usd(value){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n(value)); }
function dt(value){
  const d=new Date(value || Date.now());
  return Number.isNaN(d.getTime()) ? 'Date inconnue' : d.toLocaleString('fr-FR',{timeZone:env('TZ','Europe/Brussels'),dateStyle:'short',timeStyle:'medium'});
}
function safeName(v, fallback='Inconnu'){ return String(v || fallback).trim() || fallback; }

class RexDiscordBot {
  constructor({ getState, buildVersion }) {
    this.getState = getState;
    this.buildVersion = buildVersion;
    this.token = env('DISCORD_BOT_TOKEN');
    this.guildId = env('DISCORD_GUILD_ID');
    this.defaultChannelId = env('DISCORD_LOG_CHANNEL_ID');
    this.autoSetup = boolEnv('DISCORD_AUTO_SETUP', false);
    this.startupMessage = boolEnv('DISCORD_STARTUP_MESSAGE', true);
    this.allowedRoleIds = splitIds(env('DISCORD_ALLOWED_ROLE_IDS') || env('DISCORD_ALLOWED_ROLE_ID'));
    this.mentionRoleId = env('DISCORD_ALERT_ROLE_ID');
    this.channelIds = {
      activity: env('DISCORD_ACTIVITY_CHANNEL_ID'),
      sales: env('DISCORD_SALES_CHANNEL_ID'),
      stock: env('DISCORD_STOCK_CHANNEL_ID'),
      supplies: env('DISCORD_SUPPLIES_CHANNEL_ID'),
      cash: env('DISCORD_CASH_CHANNEL_ID'),
      team: env('DISCORD_TEAM_CHANNEL_ID'),
      admin: env('DISCORD_ADMIN_CHANNEL_ID'),
      system: env('DISCORD_SYSTEM_CHANNEL_ID')
    };
    this.client = null;
    this.ready = false;
    this.setupPromise = null;
    this.sentIds = new Set();
    this.sentOrder = [];
  }

  enabled(){ return !!this.token; }

  async start(){
    if(!this.enabled()){
      console.log('  Discord : désactivé (DISCORD_BOT_TOKEN absent)');
      return;
    }
    this.client = new Client({ intents:[GatewayIntentBits.Guilds] });
    this.client.once(Events.ClientReady, async client => {
      this.ready = true;
      console.log(`  Discord : connecté comme ${client.user.tag}`);
      client.user.setPresence({
        activities:[{name:"Rex's Diner",type:ActivityType.Watching}],
        status:'online'
      });
      try {
        await this.ensureChannels();
        await this.registerCommands();
        if(this.startupMessage){
          await this.sendEmbed('system', new EmbedBuilder()
            .setColor(COLORS.success)
            .setTitle("🦖 Rex's Diner est en ligne")
            .setDescription(`Le bot de journalisation est connecté. Version du site : **V${this.buildVersion}**.`)
            .setTimestamp());
        }
      } catch(err){
        console.error('Erreur initialisation Discord :', err.message);
      }
    });
    this.client.on(Events.InteractionCreate, i => this.onInteraction(i).catch(err=>console.error('Commande Discord :',err.message)));
    this.client.on(Events.Error, err => console.error('Discord :',err.message));
    try { await this.client.login(this.token); }
    catch(err){ console.error('Impossible de connecter le bot Discord :',err.message); }
  }

  status(){
    return {
      enabled:this.enabled(),
      ready:this.ready,
      user:this.client?.user?.tag || null,
      guildId:this.guildId || null,
      autoSetup:this.autoSetup,
      configuredChannels:Object.fromEntries(Object.entries(this.channelIds).filter(([,v])=>!!v))
    };
  }

  remember(id){
    const key=String(id || '');
    if(!key || this.sentIds.has(key)) return false;
    this.sentIds.add(key); this.sentOrder.push(key);
    while(this.sentOrder.length>2000){ const old=this.sentOrder.shift(); this.sentIds.delete(old); }
    return true;
  }

  categoryFor(action){
    const a=String(action||'').toLowerCase();
    if(a.includes('vente')) return 'sales';
    if(a.includes('stock') || a.includes('produit') || a.includes('menus') || a.includes('catégor')) return 'stock';
    if(a.includes('commande matières') || a.includes('matière') || a.includes('recette')) return 'supplies';
    if(a.includes('fonds de caisse') || a.includes('salaire')) return 'cash';
    if(a.includes('service') || a.includes('employé') || a.includes('connexion') || a.includes('verrouillage')) return 'team';
    if(a.includes('permission') || a.includes('réglage') || a.includes('sauvegarde') || a.includes('journal') || a.includes('remise')) return 'admin';
    return 'activity';
  }

  colorFor(action){
    const c=this.categoryFor(action);
    return ({sales:COLORS.success,stock:COLORS.stock,supplies:COLORS.warning,cash:COLORS.cash,team:COLORS.team,admin:COLORS.admin})[c] || COLORS.info;
  }

  iconFor(action){
    const c=this.categoryFor(action);
    return ({sales:'💵',stock:'📦',supplies:'🚚',cash:'🏦',team:'👤',admin:'⚙️'})[c] || '📝';
  }

  async ensureChannels(){
    if(!this.autoSetup || !this.guildId || !this.ready) return;
    if(this.setupPromise) return this.setupPromise;
    this.setupPromise = (async()=>{
      const guild=await this.client.guilds.fetch(this.guildId);
      await guild.channels.fetch();
      const me=await guild.members.fetchMe();
      if(!me.permissions.has(PermissionFlagsBits.ManageChannels)){
        console.warn('Discord : DISCORD_AUTO_SETUP actif mais permission « Gérer les salons » absente.');
        return;
      }
      let category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory && c.name==="🦖 Rex's Diner • Logs");
      if(!category){
        const overwrites=[
          {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
          {id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},
          ...this.allowedRoleIds.map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory]}))
        ];
        category=await guild.channels.create({name:"🦖 Rex's Diner • Logs",type:ChannelType.GuildCategory,permissionOverwrites:overwrites,reason:"Configuration automatique Rex's Diner"});
      }
      const wanted={
        activity:'rex-activite', sales:'rex-ventes', stock:'rex-stocks', supplies:'rex-commandes',
        cash:'rex-caisse', team:'rex-equipe', admin:'rex-admin', system:'rex-systeme'
      };
      for(const [key,name] of Object.entries(wanted)){
        if(this.channelIds[key]) continue;
        let ch=guild.channels.cache.find(c=>c.type===ChannelType.GuildText && c.parentId===category.id && c.name===name);
        if(!ch){ ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:category.id,reason:"Configuration automatique Rex's Diner"}); }
        this.channelIds[key]=ch.id;
      }
      if(!this.defaultChannelId) this.defaultChannelId=this.channelIds.activity;
      console.log('  Discord : salons de logs configurés automatiquement');
    })().finally(()=>{this.setupPromise=null;});
    return this.setupPromise;
  }

  async getChannel(category){
    if(!this.ready) return null;
    const id=this.channelIds[category] || this.defaultChannelId || this.channelIds.activity;
    if(id){
      try {
        const ch=await this.client.channels.fetch(id);
        if(ch?.isTextBased()) return ch;
      } catch {}
    }
    if(this.guildId){
      try {
        const guild=await this.client.guilds.fetch(this.guildId); await guild.channels.fetch();
        return guild.channels.cache.find(c=>c.isTextBased() && c.type===ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) || null;
      } catch {}
    }
    return null;
  }

  async sendEmbed(category, embed, options={}){
    if(!this.ready) return false;
    const ch=await this.getChannel(category);
    if(!ch) return false;
    const content=options.alert && this.mentionRoleId ? `<@&${this.mentionRoleId}>` : undefined;
    try { await ch.send({content,embeds:[embed],allowedMentions:{roles:content?[this.mentionRoleId]:[]}}); return true; }
    catch(err){ console.error(`Discord envoi ${category}:`,err.message); return false; }
  }

  lowStockFields(state){
    const threshold=Math.max(0,n(state?.lowStockThreshold));
    const products=arr(state?.products);
    const out=products.filter(p=>n(p.stock)<=0);
    const low=products.filter(p=>n(p.stock)>0 && n(p.stock)<=threshold);
    const fields=[];
    if(out.length) fields.push({name:'🔴 Ruptures',value:truncate(out.slice(0,12).map(p=>`${p.icon||'📦'} ${p.name}`).join('\n'),1024),inline:true});
    if(low.length) fields.push({name:'🟠 Stocks faibles',value:truncate(low.slice(0,12).map(p=>`${p.icon||'📦'} ${p.name} — **${n(p.stock)}**`).join('\n'),1024),inline:true});
    return {fields,alert:out.length>0};
  }

  buildJournalEmbed(entry,state){
    const action=safeName(entry.action,'Activité');
    const embed=new EmbedBuilder()
      .setColor(this.colorFor(action))
      .setTitle(`${this.iconFor(action)} ${action}`)
      .setDescription(truncate(entry.detail || 'Action enregistrée.', 4000))
      .addFields(
        {name:'Employé',value:truncate(safeName(entry.employee,'Système'),256),inline:true},
        {name:'Date & heure',value:dt(entry.date),inline:true}
      )
      .setFooter({text:`Rex's Diner • V${this.buildVersion}`})
      .setTimestamp(new Date(entry.date || Date.now()));

    let alert=false;
    if(action==='Vente'){
      const match=String(entry.detail||'').match(/RX-\d+/i);
      const sale=match ? arr(state.sales).find(s=>String(s.id)===match[0]) : null;
      if(sale){
        const lines=arr(sale.items).map(i=>`${n(i.qty)} × ${i.name} — ${usd(n(i.price)*n(i.qty))}`);
        embed.setTitle(`💵 Vente encaissée • ${sale.id}`)
          .setDescription(lines.length?truncate(lines.join('\n'),3500):'Vente encaissée.')
          .addFields(
            {name:'Payé par le client',value:sale.currency==='MXN'?peso(sale.paidTotal):usd(sale.paidTotal),inline:true},
            {name:'Net versé en caisse',value:peso(sale.creditedPesos ?? (sale.currency==='MXN'?sale.paidTotal:0)),inline:true},
            {name:'Paiement',value:`${sale.method||'Espèces'} • ${sale.currency||'USD'}`,inline:true}
          );
        if(n(sale.discount)>0) embed.addFields({name:'Remise',value:`${n(sale.discount)} %`,inline:true});
        if(sale.note) embed.addFields({name:'Note',value:truncate(sale.note,1024)});
        const stock=this.lowStockFields(state); stock.fields.forEach(f=>embed.addFields(f)); alert=stock.alert;
      }
    } else if(action==='Commande matières'){
      const match=String(entry.detail||'').match(/MAT-\d+/i);
      const order=match ? arr(state.supplyOrders).find(o=>String(o.id)===match[0]) : null;
      if(order){
        const items=arr(order.items).map(i=>`${i.qty} ${i.unit||''} × ${i.name} — ${peso(n(i.qty)*n(i.pricePesos))}`);
        embed.setTitle(`🚚 Commande de matières • ${order.id}`)
          .setDescription(items.length?truncate(items.join('\n'),3400):'Commande de matières validée.')
          .addFields(
            {name:'Total payé',value:peso(order.totalPesos),inline:true},
            {name:'Caisse après achat',value:peso(order.balanceAfter),inline:true}
          );
        if(arr(order.recipes).length){ embed.addFields({name:'Recettes sélectionnées',value:truncate(arr(order.recipes).map(r=>`${r.qty} × ${r.name || 'Recette'}`).join('\n'),1024)}); }
        if(arr(order.producedProducts).length){ embed.addFields({name:'Produits ajoutés au stock',value:truncate(arr(order.producedProducts).map(p=>`+${p.qty} ${p.name} • ${p.stockBefore} → ${p.stockAfter}`).join('\n'),1024)}); }
      }
    } else if(action==='Stock' || action==='Produit' || action==='Menus'){
      const stock=this.lowStockFields(state); stock.fields.forEach(f=>embed.addFields(f)); alert=stock.alert;
    } else if(action==='Fonds de caisse' || action==='Salaire'){
      embed.addFields({name:'Solde actuel',value:peso(state.cashDrawerPesos),inline:true});
    } else if(action==='Service'){
      const emp=arr(state.employees).find(e=>e.name===entry.employee);
      if(emp) embed.addFields({name:'Statut',value:emp.inService?'🟢 En service':'⚫ Hors service',inline:true});
    }
    return {embed,alert};
  }

  async notifyJournal(entry,state){
    if(!entry || !this.remember(entry.id)) return false;
    const {embed,alert}=this.buildJournalEmbed(entry,state || this.getState() || {});
    return this.sendEmbed(this.categoryFor(entry.action),embed,{alert});
  }

  async handleStateChange(previous,next){
    if(!this.ready || !previous || !next) return;
    const oldIds=new Set(arr(previous.journal).map(x=>String(x.id)));
    const fresh=arr(next.journal).filter(x=>!oldIds.has(String(x.id))).slice().reverse();
    for(const entry of fresh) await this.notifyJournal(entry,next);
    if(arr(previous.journal).length>0 && arr(next.journal).length===0){
      await this.sendEmbed('admin',new EmbedBuilder().setColor(COLORS.danger).setTitle('🧹 Journal vidé').setDescription('Le journal d’activité du site a été entièrement effacé.').setTimestamp(),{alert:true});
    }
  }

  commandAllowed(interaction){
    if(!interaction.inGuild()) return false;
    if(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    if(!this.allowedRoleIds.length) return false;
    const roles=interaction.member?.roles?.cache;
    return this.allowedRoleIds.some(id=>roles?.has(id));
  }

  async registerCommands(){
    if(!this.client?.application) return;
    const defs=[
      new SlashCommandBuilder().setName('rex-status').setDescription("État du site Rex's Diner et de sa synchronisation"),
      new SlashCommandBuilder().setName('rex-stats').setDescription("Résumé des ventes et de la caisse"),
      new SlashCommandBuilder().setName('rex-services').setDescription('Voir les employés actuellement en service'),
      new SlashCommandBuilder().setName('rex-stock').setDescription('Voir les stocks faibles et les ruptures'),
      new SlashCommandBuilder().setName('rex-test').setDescription('Envoyer un message de test dans les logs Discord'),
      new SlashCommandBuilder().setName('rex-help').setDescription('Afficher les commandes du bot Rex')
    ].map(x=>x.setDMPermission(false).toJSON());
    if(this.guildId){
      const guild=await this.client.guilds.fetch(this.guildId);
      await guild.commands.set(defs);
    } else {
      await this.client.application.commands.set(defs);
    }
    console.log('  Discord : commandes /rex-* enregistrées');
  }

  async onInteraction(interaction){
    if(!interaction.isChatInputCommand() || !interaction.commandName.startsWith('rex-')) return;
    if(!this.commandAllowed(interaction)){
      return interaction.reply({content:'⛔ Cette commande est réservée aux administrateurs ou aux rôles autorisés.',ephemeral:true});
    }
    const state=this.getState() || {};
    if(interaction.commandName==='rex-status'){
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.success).setTitle("🦖 Rex's Diner • Statut").addFields(
        {name:'Site',value:'🟢 En ligne',inline:true},
        {name:'Bot Discord',value:this.ready?'🟢 Connecté':'🔴 Déconnecté',inline:true},
        {name:'Version',value:`V${this.buildVersion}`,inline:true},
        {name:'Fond de caisse',value:peso(state.cashDrawerPesos),inline:true},
        {name:'Employés en service',value:String(arr(state.employees).filter(e=>e.inService).length),inline:true}
      ).setTimestamp()],ephemeral:true});
    }
    if(interaction.commandName==='rex-stats'){
      const sales=arr(state.sales); const credited=sales.reduce((s,x)=>s+n(x.creditedPesos ?? (x.currency==='MXN'?x.paidTotal:0)),0);
      const items=sales.reduce((s,x)=>s+arr(x.items).reduce((a,i)=>a+n(i.qty),0),0);
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.success).setTitle('💵 Rex • Statistiques').addFields(
        {name:'Ventes',value:String(sales.length),inline:true},{name:'Articles encaissés',value:String(items),inline:true},
        {name:'Total net encaissé',value:peso(credited),inline:true},{name:'Fond de caisse actuel',value:peso(state.cashDrawerPesos),inline:true}
      ).setTimestamp()],ephemeral:true});
    }
    if(interaction.commandName==='rex-services'){
      const active=arr(state.employees).filter(e=>e.inService);
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.team).setTitle('👥 Employés en service').setDescription(active.length?active.map(e=>`🟢 **${e.name}** • ${e.role||'Employé'}\nDepuis : ${dt(e.serviceStartedAt)}`).join('\n\n'):'Aucun employé en service.').setTimestamp()],ephemeral:true});
    }
    if(interaction.commandName==='rex-stock'){
      const threshold=Math.max(0,n(state.lowStockThreshold)); const products=arr(state.products);
      const list=products.filter(p=>n(p.stock)<=threshold).sort((a,b)=>n(a.stock)-n(b.stock));
      return interaction.reply({embeds:[new EmbedBuilder().setColor(list.some(p=>n(p.stock)<=0)?COLORS.danger:COLORS.stock).setTitle('📦 État des stocks').setDescription(list.length?truncate(list.map(p=>`${n(p.stock)<=0?'🔴':'🟠'} ${p.icon||'📦'} **${p.name}** — ${n(p.stock)}`).join('\n'),4000):'🟢 Aucun stock faible ou en rupture.').setFooter({text:`Seuil stock faible : ${threshold}`}).setTimestamp()],ephemeral:true});
    }
    if(interaction.commandName==='rex-test'){
      await interaction.reply({content:'✅ Test envoyé dans le salon de logs.',ephemeral:true});
      return this.sendEmbed('system',new EmbedBuilder().setColor(COLORS.info).setTitle('🧪 Test du bot Rex').setDescription(`Test lancé par **${interaction.user.tag}**. La connexion fonctionne correctement.`).setTimestamp());
    }
    return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.info).setTitle('🦖 Rex Bot • Aide').setDescription([
      '`/rex-status` — état du site et du bot',
      '`/rex-stats` — ventes et caisse',
      '`/rex-services` — employés en service',
      '`/rex-stock` — stocks faibles et ruptures',
      '`/rex-test` — tester les notifications',
      '`/rex-help` — cette aide'
    ].join('\n')).setFooter({text:"Commandes réservées aux administrateurs / rôles autorisés"})],ephemeral:true});
  }
}

module.exports = { RexDiscordBot };
