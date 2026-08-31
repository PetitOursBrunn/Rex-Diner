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
  payroll: 0x2ECC71,
  stock: 0x3498DB,
  team: 0x9B59B6,
  admin: 0x95A5A6,
  report: 0x1ABC9C
};

function env(name, fallback='') { return String(process.env[name] || fallback).trim(); }
function boolEnv(name, fallback=false) {
  const value = env(name);
  return value ? ['1','true','yes','oui','on'].includes(value.toLowerCase()) : fallback;
}
function splitIds(value) { return String(value || '').split(/[;,\s]+/).map(v=>v.trim()).filter(Boolean); }
function arr(v){ return Array.isArray(v) ? v : []; }
function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function clamp(v,min,max){ return Math.min(max,Math.max(min,n(v))); }
function truncate(value, max=1000){
  const text=String(value ?? '');
  return text.length<=max?text:text.slice(0,Math.max(0,max-1))+'…';
}
function peso(value){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(n(value)); }
function usd(value){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n(value)); }
function safeName(v, fallback='Inconnu'){ return String(v || fallback).trim() || fallback; }
function norm(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

class RexDiscordBot {
  constructor({ getState, mutateState, buildVersion }) {
    this.getState = getState;
    this.mutateState = mutateState;
    this.buildVersion = buildVersion;
    this.token = env('DISCORD_BOT_TOKEN');
    this.guildId = env('DISCORD_GUILD_ID');
    this.defaultChannelId = env('DISCORD_LOG_CHANNEL_ID');
    this.autoSetup = boolEnv('DISCORD_AUTO_SETUP', false);
    this.startupMessage = boolEnv('DISCORD_STARTUP_MESSAGE', true);
    this.allowedRoleIds = splitIds(env('DISCORD_ALLOWED_ROLE_IDS') || env('DISCORD_ALLOWED_ROLE_ID'));
    this.mentionRoleId = env('DISCORD_ALERT_ROLE_ID');
    this.alertLowStock = boolEnv('DISCORD_ALERT_LOW_STOCK', true);
    this.allowCashForRoles = boolEnv('DISCORD_ALLOW_CASH_FOR_ROLES', false);
    this.dailyReportTime = env('DISCORD_DAILY_REPORT_TIME','23:55');
    this.weeklyReportTime = env('DISCORD_WEEKLY_REPORT_TIME','20:00');
    this.weeklyReportDay = clamp(env('DISCORD_WEEKLY_REPORT_DAY','0'),0,6); // 0 dimanche
    this.timeZone = env('TZ','Europe/Brussels');
    this.channelIds = {
      activity: env('DISCORD_ACTIVITY_CHANNEL_ID'),
      sales: env('DISCORD_SALES_CHANNEL_ID'),
      stock: env('DISCORD_STOCK_CHANNEL_ID'),
      supplies: env('DISCORD_SUPPLIES_CHANNEL_ID'),
      cash: env('DISCORD_CASH_CHANNEL_ID'),
      payroll: env('DISCORD_PAYROLL_CHANNEL_ID'),
      team: env('DISCORD_TEAM_CHANNEL_ID'),
      admin: env('DISCORD_ADMIN_CHANNEL_ID'),
      system: env('DISCORD_SYSTEM_CHANNEL_ID'),
      alerts: env('DISCORD_ALERTS_CHANNEL_ID'),
      reports: env('DISCORD_REPORTS_CHANNEL_ID')
    };
    this.client = null;
    this.ready = false;
    this.setupPromise = null;
    this.sentIds = new Set();
    this.sentOrder = [];
    this.reportTimer = null;
    this.deliveryQueue = Promise.resolve();
    this.lastDeliveryAt = 0;
  }

  enabled(){ return !!this.token; }

  dt(value){
    const d=new Date(value || Date.now());
    return Number.isNaN(d.getTime()) ? 'Date inconnue' : d.toLocaleString('fr-FR',{timeZone:this.timeZone,dateStyle:'short',timeStyle:'medium'});
  }

  localParts(value=Date.now()){
    const parts = new Intl.DateTimeFormat('en-CA',{
      timeZone:this.timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date(value));
    const o={}; for(const p of parts) if(p.type!=='literal') o[p.type]=p.value;
    const wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday] ?? 0;
    return {date:`${o.year}-${o.month}-${o.day}`,hour:o.hour,minute:o.minute,weekday:wd};
  }

  async start(){
    if(!this.enabled()){
      console.log('  Discord : désactivé (DISCORD_BOT_TOKEN absent)');
      return;
    }
    this.client = new Client({ intents:[GatewayIntentBits.Guilds] });
    this.client.once(Events.ClientReady, async client => {
      this.ready = true;
      console.log(`  Discord : connecté comme ${client.user.tag}`);
      client.user.setPresence({activities:[{name:"Rex's Diner • /rex-help",type:ActivityType.Watching}],status:'online'});
      try {
        await this.ensureChannels();
        await this.registerCommands();
        this.startSchedulers();
        if(this.startupMessage){
          await this.sendEmbed('system', new EmbedBuilder()
            .setColor(COLORS.success)
            .setTitle("🦖 Rex's Diner est en ligne")
            .setDescription(`Bot opérationnel • **V${this.buildVersion}**\nLogs, commandes de gestion, alertes et rapports automatiques sont actifs.`)
            .setTimestamp());
        }
      } catch(err){ console.error('Erreur initialisation Discord :', err.message); }
    });
    this.client.on(Events.InteractionCreate, i => this.onInteraction(i).catch(async err=>{
      console.error('Commande Discord :',err.message);
      try {
        const payload={content:'❌ Une erreur est survenue pendant la commande.',ephemeral:true};
        if(i.deferred || i.replied) await i.editReply(payload); else if(i.isRepliable()) await i.reply(payload);
      } catch {}
    }));
    this.client.on(Events.Error, err => console.error('Discord :',err.message));
    this.client.on(Events.Warn, msg => console.warn('Discord :',msg));
    try { await this.client.login(this.token); }
    catch(err){ console.error('Impossible de connecter le bot Discord :',err.message); }
  }

  startSchedulers(){
    if(this.reportTimer) clearInterval(this.reportTimer);
    this.reportTimer=setInterval(()=>this.runScheduledReports().catch(err=>console.error('Rapports Discord :',err.message)),60_000);
    setTimeout(()=>this.runScheduledReports().catch(()=>{}),5000);
  }

  status(){
    return {
      enabled:this.enabled(), ready:this.ready, user:this.client?.user?.tag || null,
      guildId:this.guildId || null, autoSetup:this.autoSetup,
      dailyReportTime:this.dailyReportTime, weeklyReportTime:this.weeklyReportTime,
      configuredChannels:Object.fromEntries(Object.entries(this.channelIds).filter(([,v])=>!!v))
    };
  }

  remember(id){
    const key=String(id || '');
    if(!key || this.sentIds.has(key)) return false;
    this.sentIds.add(key); this.sentOrder.push(key);
    while(this.sentOrder.length>3000){ const old=this.sentOrder.shift(); this.sentIds.delete(old); }
    return true;
  }

  categoryFor(action){
    const a=norm(action);
    if(a.includes('vente')) return 'sales';
    if(a.includes('stock') || a.includes('produit') || a.includes('menus') || a.includes('categor')) return 'stock';
    if(a.includes('commande matieres') || a.includes('matiere') || a.includes('recette')) return 'supplies';
    if(a.includes('salaire')) return 'payroll';
    if(a.includes('fonds de caisse') || a.includes('caisse')) return 'cash';
    if(a.includes('service') || a.includes('employe') || a.includes('connexion') || a.includes('verrouillage')) return 'team';
    if(a.includes('permission') || a.includes('reglage') || a.includes('sauvegarde') || a.includes('journal') || a.includes('remise')) return 'admin';
    return 'activity';
  }

  colorFor(action){
    const c=this.categoryFor(action);
    return ({sales:COLORS.success,stock:COLORS.stock,supplies:COLORS.warning,cash:COLORS.cash,payroll:COLORS.payroll,team:COLORS.team,admin:COLORS.admin})[c] || COLORS.info;
  }
  iconFor(action){
    const c=this.categoryFor(action);
    return ({sales:'💵',stock:'📦',supplies:'🚚',cash:'🏦',payroll:'💰',team:'👤',admin:'⚙️'})[c] || '📝';
  }

  async ensureChannels(){
    if(!this.autoSetup || !this.guildId || !this.ready) return;
    if(this.setupPromise) return this.setupPromise;
    this.setupPromise=(async()=>{
      const guild=await this.client.guilds.fetch(this.guildId); await guild.channels.fetch();
      const me=await guild.members.fetchMe();
      if(!me.permissions.has(PermissionFlagsBits.ManageChannels)){
        console.warn('Discord : DISCORD_AUTO_SETUP actif mais permission « Gérer les salons » absente.'); return;
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
      // Si des rôles autorisés ont été ajoutés après la création initiale, on synchronise aussi leurs permissions.
      for(const roleId of this.allowedRoleIds){
        try { await category.permissionOverwrites.edit(roleId,{ViewChannel:true,ReadMessageHistory:true}); } catch(err){ console.warn(`Discord : rôle ${roleId} non appliqué aux logs : ${err.message}`); }
      }
      const wanted={
        activity:'rex-activite',sales:'rex-ventes',stock:'rex-stocks',supplies:'rex-commandes',cash:'rex-caisse',payroll:'rex-salaires',team:'rex-equipe',
        admin:'rex-admin',system:'rex-systeme',alerts:'rex-alertes',reports:'rex-rapports'
      };
      for(const [key,name] of Object.entries(wanted)){
        if(this.channelIds[key]) continue;
        let ch=guild.channels.cache.find(c=>c.type===ChannelType.GuildText && c.parentId===category.id && c.name===name);
        if(!ch) ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:category.id,reason:"Configuration automatique Rex's Diner"});
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
    if(id){ try { const ch=await this.client.channels.fetch(id); if(ch?.isTextBased()) return ch; } catch {} }
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
    this.deliveryQueue=this.deliveryQueue.then(async()=>{
      const ch=await this.getChannel(category); if(!ch) return false;
      const content=options.alert && this.mentionRoleId ? `<@&${this.mentionRoleId}>` : undefined;
      const wait=Math.max(0,250-(Date.now()-this.lastDeliveryAt)); if(wait) await new Promise(r=>setTimeout(r,wait));
      for(let attempt=0;attempt<3;attempt++){
        try {
          await ch.send({content,embeds:[embed],allowedMentions:{roles:content?[this.mentionRoleId]:[]}});
          this.lastDeliveryAt=Date.now(); return true;
        } catch(err){
          if(attempt===2){ console.error(`Discord envoi ${category}:`,err.message); return false; }
          await new Promise(r=>setTimeout(r,500*(attempt+1)));
        }
      }
      return false;
    }).catch(err=>{console.error('File Discord :',err.message); return false;});
    return this.deliveryQueue;
  }

  stockStatus(stock,threshold){ return n(stock)<=0?'out':n(stock)<=threshold?'low':'ok'; }
  lowStockFields(state){
    const threshold=Math.max(0,n(state?.lowStockThreshold)); const products=arr(state?.products);
    const out=products.filter(p=>n(p.stock)<=0); const low=products.filter(p=>n(p.stock)>0 && n(p.stock)<=threshold);
    const fields=[];
    if(out.length) fields.push({name:'🔴 Ruptures',value:truncate(out.slice(0,12).map(p=>`${p.icon||'📦'} ${p.name}`).join('\n'),1024),inline:true});
    if(low.length) fields.push({name:'🟠 Stocks faibles',value:truncate(low.slice(0,12).map(p=>`${p.icon||'📦'} ${p.name} — **${n(p.stock)}**`).join('\n'),1024),inline:true});
    return {fields,alert:out.length>0 || (this.alertLowStock && low.length>0)};
  }

  buildJournalEmbed(entry,state){
    const action=safeName(entry.action,'Activité');
    const embed=new EmbedBuilder().setColor(this.colorFor(action)).setTitle(`${this.iconFor(action)} ${action}`)
      .setDescription(truncate(entry.detail || 'Action enregistrée.',4000))
      .addFields({name:'Employé',value:truncate(safeName(entry.employee,'Système'),256),inline:true},{name:'Date & heure',value:this.dt(entry.date),inline:true})
      .setFooter({text:`Rex's Diner • V${this.buildVersion}`}).setTimestamp(new Date(entry.date || Date.now()));
    let alert=false;
    if(norm(action)==='vente'){
      const match=String(entry.detail||'').match(/RX-\d+/i); const sale=match?arr(state.sales).find(s=>String(s.id)===match[0]):null;
      if(sale){
        const lines=arr(sale.items).map(i=>`${n(i.qty)} × ${i.name} — ${usd(n(i.price)*n(i.qty))}`);
        embed.setTitle(`💵 Vente encaissée • ${sale.id}`).setDescription(lines.length?truncate(lines.join('\n'),3500):'Vente encaissée.')
          .addFields({name:'Payé par le client',value:sale.currency==='MXN'?peso(sale.paidTotal):usd(sale.paidTotal),inline:true},
            {name:'Net versé en caisse',value:peso(sale.creditedPesos ?? (sale.currency==='MXN'?sale.paidTotal:0)),inline:true},
            {name:'Paiement',value:`${sale.method||'Espèces'} • ${sale.currency||'USD'}`,inline:true});
        if(n(sale.discount)>0) embed.addFields({name:'Remise',value:`${n(sale.discount)} %`,inline:true});
        if(sale.note) embed.addFields({name:'Note',value:truncate(sale.note,1024)});
      }
    } else if(norm(action).includes('commande matieres')){
      const match=String(entry.detail||'').match(/MAT-\d+/i); const order=match?arr(state.supplyOrders).find(o=>String(o.id)===match[0]):null;
      if(order){
        const items=arr(order.items).map(i=>`${i.qty} ${i.unit||''} × ${i.name} — ${peso(n(i.qty)*n(i.pricePesos))}`);
        embed.setTitle(`🚚 Commande de matières • ${order.id}`).setDescription(items.length?truncate(items.join('\n'),3400):'Commande de matières validée.')
          .addFields({name:'Total payé',value:peso(order.totalPesos),inline:true},{name:'Caisse après achat',value:peso(order.balanceAfter),inline:true});
        if(arr(order.recipes).length) embed.addFields({name:'Recettes sélectionnées',value:truncate(arr(order.recipes).map(r=>`${r.qty} × ${r.name||'Recette'}`).join('\n'),1024)});
        if(arr(order.producedProducts).length) embed.addFields({name:'Produits ajoutés au stock',value:truncate(arr(order.producedProducts).map(p=>`+${p.qty} ${p.name} • ${p.stockBefore} → ${p.stockAfter}`).join('\n'),1024)});
      }
    } else if(this.categoryFor(action)==='stock'){
      const stock=this.lowStockFields(state); stock.fields.forEach(f=>embed.addFields(f));
    } else if(this.categoryFor(action)==='cash' || this.categoryFor(action)==='payroll') embed.addFields({name:'Solde actuel',value:peso(state.cashDrawerPesos),inline:true});
    else if(this.categoryFor(action)==='team'){
      const emp=arr(state.employees).find(e=>e.name===entry.employee || String(entry.detail||'').includes(e.name));
      if(emp) embed.addFields({name:'Statut',value:emp.inService?'🟢 En service':'⚫ Hors service',inline:true});
    }
    return {embed,alert};
  }

  async notifyJournal(entry,state){
    if(!entry || !this.remember(entry.id)) return false;
    const {embed,alert}=this.buildJournalEmbed(entry,state || this.getState() || {});
    return this.sendEmbed(this.categoryFor(entry.action),embed,{alert});
  }

  async handleStockTransitions(previous,next){
    const threshold=Math.max(0,n(next.lowStockThreshold)); const old=new Map(arr(previous.products).map(p=>[String(p.id),p]));
    for(const p of arr(next.products)){
      const before=old.get(String(p.id)); if(!before) continue;
      const a=this.stockStatus(before.stock,threshold), b=this.stockStatus(p.stock,threshold); if(a===b) continue;
      if((a==='ok' && (b==='low'||b==='out')) || (a==='low'&&b==='out')){
        const severity=b==='out'?'🔴 Rupture de stock':'🟠 Stock faible';
        await this.sendEmbed('alerts',new EmbedBuilder().setColor(b==='out'?COLORS.danger:COLORS.warning).setTitle(`${severity} • ${p.name}`)
          .setDescription(`Stock : **${n(before.stock)} → ${n(p.stock)}**\nSeuil configuré : **${threshold}**`).setTimestamp(),{alert:b==='out'||this.alertLowStock});
      } else if((a==='out'||a==='low') && b==='ok'){
        await this.sendEmbed('alerts',new EmbedBuilder().setColor(COLORS.success).setTitle(`🟢 Stock rétabli • ${p.name}`)
          .setDescription(`Stock : **${n(before.stock)} → ${n(p.stock)}**`).setTimestamp());
      }
    }
  }

  async handleStateChange(previous,next){
    if(!this.ready || !previous || !next) return;
    const oldIds=new Set(arr(previous.journal).map(x=>String(x.id)));
    const fresh=arr(next.journal).filter(x=>!oldIds.has(String(x.id))).slice().reverse();
    for(const entry of fresh) await this.notifyJournal(entry,next);
    await this.handleStockTransitions(previous,next);
    if(arr(previous.journal).length>0 && arr(next.journal).length===0){
      await this.sendEmbed('admin',new EmbedBuilder().setColor(COLORS.danger).setTitle('🧹 Journal vidé').setDescription('Le journal d’activité du site a été entièrement effacé.').setTimestamp(),{alert:true});
    }
  }

  commandAllowed(interaction){
    if(!interaction.inGuild()) return false;
    if(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    if(!this.allowedRoleIds.length) return false;
    const roles=interaction.member?.roles?.cache; return this.allowedRoleIds.some(id=>roles?.has(id));
  }
  cashAllowed(interaction){ return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || (this.allowCashForRoles && this.commandAllowed(interaction)); }

  employeeSales(state,employeeId,employeeName){
    return arr(state.sales).filter(s=> employeeId ? String(s.employeeId)===String(employeeId) : norm(s.employee)===norm(employeeName));
  }
  credited(s){ return n(s.creditedPesos ?? (s.currency==='MXN'?s.paidTotal:0)); }
  periodSales(state,period='today',employeeId=null){
    const now=Date.now(), today=this.localParts(now).date;
    return arr(state.sales).filter(s=>{
      const t=new Date(s.date||0).getTime(); if(!Number.isFinite(t)) return false;
      let ok=true;
      if(period==='today') ok=this.localParts(t).date===today;
      else if(period==='7d') ok=t>=now-7*86400000;
      else if(period==='30d') ok=t>=now-30*86400000;
      if(employeeId) ok=ok && String(s.employeeId)===String(employeeId);
      return ok;
    });
  }

  statsEmbed(state,period='today',employeeId=null,title='📊 Rex • Statistiques'){
    const sales=this.periodSales(state,period,employeeId); const credited=sales.reduce((a,s)=>a+this.credited(s),0);
    const units=sales.reduce((a,s)=>a+arr(s.items).reduce((b,i)=>b+n(i.qty),0),0);
    const byProduct=new Map(), byEmp=new Map();
    for(const s of sales){
      byEmp.set(s.employee,(byEmp.get(s.employee)||0)+this.credited(s));
      for(const i of arr(s.items)) byProduct.set(i.name,(byProduct.get(i.name)||0)+n(i.qty));
    }
    const topP=[...byProduct].sort((a,b)=>b[1]-a[1]).slice(0,5); const topE=[...byEmp].sort((a,b)=>b[1]-a[1]).slice(0,5);
    const labels={today:"Aujourd'hui",'7d':'7 derniers jours','30d':'30 derniers jours',all:'Depuis le début'};
    const embed=new EmbedBuilder().setColor(COLORS.report).setTitle(title).setDescription(`Période : **${labels[period]||period}**`)
      .addFields({name:'Ventes',value:String(sales.length),inline:true},{name:'Articles',value:String(units),inline:true},{name:'Net encaissé',value:peso(credited),inline:true},
        {name:'Ticket moyen',value:peso(sales.length?credited/sales.length:0),inline:true},{name:'Fond de caisse',value:peso(state.cashDrawerPesos),inline:true},{name:'En service',value:String(arr(state.employees).filter(e=>e.inService).length),inline:true});
    if(topP.length) embed.addFields({name:'🏆 Produits les plus vendus',value:truncate(topP.map(([k,v],i)=>`${i+1}. **${k}** — ${v}`).join('\n'),1024),inline:true});
    if(!employeeId && topE.length) embed.addFields({name:'👥 Encaissements employés',value:truncate(topE.map(([k,v],i)=>`${i+1}. **${k}** — ${peso(v)}`).join('\n'),1024),inline:true});
    const stock=this.lowStockFields(state); if(stock.fields.length) stock.fields.forEach(f=>embed.addFields(f));
    return embed.setFooter({text:`Rex's Diner • V${this.buildVersion}`}).setTimestamp();
  }

  async mutate(actor,action,detail,fn){
    if(typeof this.mutateState!=='function') throw new Error('Gestion Discord indisponible sur ce serveur');
    return this.mutateState({actor,action,detail,mutator:fn});
  }

  actor(interaction){ return `Discord • ${interaction.user.globalName || interaction.user.username}`; }

  async registerCommands(){
    if(!this.client?.application) return;
    const periodChoices=[{name:"Aujourd'hui",value:'today'},{name:'7 derniers jours',value:'7d'},{name:'30 derniers jours',value:'30d'},{name:'Depuis le début',value:'all'}];
    const defs=[
      new SlashCommandBuilder().setName('rex-dashboard').setDescription("Tableau de bord complet de Rex's Diner"),
      new SlashCommandBuilder().setName('rex-status').setDescription("État du site Rex's Diner et du bot"),
      new SlashCommandBuilder().setName('rex-stats').setDescription('Statistiques des ventes').addStringOption(o=>o.setName('periode').setDescription('Période').addChoices(...periodChoices)).addStringOption(o=>o.setName('employe').setDescription('Employé').setAutocomplete(true)),
      new SlashCommandBuilder().setName('rex-ventes').setDescription('Dernières ventes détaillées').addStringOption(o=>o.setName('periode').setDescription('Période').addChoices(...periodChoices)).addStringOption(o=>o.setName('employe').setDescription('Employé').setAutocomplete(true)).addIntegerOption(o=>o.setName('limite').setDescription('Nombre de tickets (1-15)').setMinValue(1).setMaxValue(15)),
      new SlashCommandBuilder().setName('rex-services').setDescription('Voir les employés actuellement en service'),
      new SlashCommandBuilder().setName('rex-service').setDescription('Démarrer ou terminer le service d’un employé').addStringOption(o=>o.setName('employe').setDescription('Employé').setAutocomplete(true).setRequired(true)).addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Prendre le service',value:'start'},{name:'Terminer le service',value:'stop'})).addBooleanOption(o=>o.setName('confirmer').setDescription('Confirmer la modification').setRequired(true)),
      new SlashCommandBuilder().setName('rex-stock').setDescription('Consulter les stocks').addStringOption(o=>o.setName('filtre').setDescription('Filtre').addChoices({name:'Alertes seulement',value:'alerts'},{name:'Ruptures',value:'out'},{name:'Tous',value:'all'})),
      new SlashCommandBuilder().setName('rex-stock-ajuster').setDescription('Ajuster le stock d’un produit').addStringOption(o=>o.setName('produit').setDescription('Produit').setAutocomplete(true).setRequired(true)).addStringOption(o=>o.setName('mode').setDescription('Mode').setRequired(true).addChoices({name:'Ajouter',value:'add'},{name:'Retirer',value:'remove'},{name:'Définir exactement',value:'set'})).addIntegerOption(o=>o.setName('quantite').setDescription('Quantité').setRequired(true).setMinValue(0).setMaxValue(100000)).addBooleanOption(o=>o.setName('confirmer').setDescription('Confirmer la modification').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setMaxLength(150)),
      new SlashCommandBuilder().setName('rex-caisse').setDescription('Consulter le fond de caisse et les derniers mouvements'),
      new SlashCommandBuilder().setName('rex-caisse-ajuster').setDescription('Ajuster le fond de caisse (administrateur)').addStringOption(o=>o.setName('mode').setDescription('Mode').setRequired(true).addChoices({name:'Ajouter',value:'add'},{name:'Retirer',value:'remove'},{name:'Définir exactement',value:'set'})).addNumberOption(o=>o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(0)).addStringOption(o=>o.setName('devise').setDescription('Devise').setRequired(true).addChoices({name:'Pesos',value:'MXN'},{name:'Dollars',value:'USD'})).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(true).setMaxLength(150)).addBooleanOption(o=>o.setName('confirmer').setDescription('Confirmer la modification').setRequired(true)),
      new SlashCommandBuilder().setName('rex-commandes').setDescription('Voir les dernières commandes de matières').addIntegerOption(o=>o.setName('limite').setDescription('Nombre de commandes').setMinValue(1).setMaxValue(10)),
      new SlashCommandBuilder().setName('rex-rapport').setDescription('Générer un rapport').addStringOption(o=>o.setName('periode').setDescription('Période').setRequired(true).addChoices(...periodChoices)).addBooleanOption(o=>o.setName('publier').setDescription('Publier dans #rex-rapports')),
      new SlashCommandBuilder().setName('rex-config').setDescription('Afficher la configuration et la santé du bot'),
      new SlashCommandBuilder().setName('rex-test').setDescription('Tester les notifications Discord'),
      new SlashCommandBuilder().setName('rex-help').setDescription('Afficher toutes les commandes du bot Rex')
    ].map(x=>x.setDMPermission(false).toJSON());
    if(this.guildId){ const guild=await this.client.guilds.fetch(this.guildId); await guild.commands.set(defs); }
    else await this.client.application.commands.set(defs);
    console.log('  Discord : commandes /rex-* enregistrées');
  }

  async autocomplete(interaction){
    const focused=interaction.options.getFocused(true); const q=norm(focused.value); const state=this.getState()||{};
    let list=[];
    if(focused.name==='employe') list=arr(state.employees).map(e=>({name:`${e.name} • ${e.role||'Employé'}`,value:String(e.id)}));
    if(focused.name==='produit') list=arr(state.products).map(p=>({name:`${p.name} • stock ${n(p.stock)}`,value:String(p.id)}));
    list=list.filter(x=>norm(x.name).includes(q)).slice(0,25); return interaction.respond(list);
  }

  async onInteraction(interaction){
    if(interaction.isAutocomplete()) return this.autocomplete(interaction);
    if(!interaction.isChatInputCommand() || !interaction.commandName.startsWith('rex-')) return;
    if(!this.commandAllowed(interaction)) return interaction.reply({content:'⛔ Commande réservée aux administrateurs ou aux rôles autorisés.',ephemeral:true});
    const state=this.getState() || {}; const cmd=interaction.commandName;

    if(cmd==='rex-status'){
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.success).setTitle("🦖 Rex's Diner • Statut").addFields(
        {name:'Site',value:'🟢 En ligne',inline:true},{name:'Bot Discord',value:this.ready?'🟢 Connecté':'🔴 Déconnecté',inline:true},{name:'Version',value:`V${this.buildVersion}`,inline:true},
        {name:'Fond de caisse',value:peso(state.cashDrawerPesos),inline:true},{name:'Employés en service',value:String(arr(state.employees).filter(e=>e.inService).length),inline:true},{name:'Ventes enregistrées',value:String(arr(state.sales).length),inline:true}
      ).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-dashboard'){
      const e=this.statsEmbed(state,'today',null,"🦖 Rex's Diner • Tableau de bord"); return interaction.reply({embeds:[e],ephemeral:true});
    }

    if(cmd==='rex-stats'){
      const period=interaction.options.getString('periode')||'today', employeeId=interaction.options.getString('employe');
      const emp=employeeId?arr(state.employees).find(e=>String(e.id)===employeeId):null;
      const e=this.statsEmbed(state,period,employeeId,emp?`📊 Statistiques • ${emp.name}`:'📊 Rex • Statistiques'); return interaction.reply({embeds:[e],ephemeral:true});
    }

    if(cmd==='rex-ventes'){
      const period=interaction.options.getString('periode')||'today', employeeId=interaction.options.getString('employe'), limit=interaction.options.getInteger('limite')||8;
      const sales=this.periodSales(state,period,employeeId).slice(0,limit);
      const desc=sales.length?sales.map(s=>`**${s.id}** • ${this.dt(s.date)}\n👤 ${s.employee} • ${peso(this.credited(s))}\n${truncate(arr(s.items).map(i=>`${i.qty}× ${i.name}`).join(', '),250)}`).join('\n\n'):'Aucune vente pour cette sélection.';
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.success).setTitle('💵 Dernières ventes').setDescription(truncate(desc,4000)).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-services'){
      const active=arr(state.employees).filter(e=>e.inService);
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.team).setTitle('👥 Employés en service').setDescription(active.length?active.map(e=>`🟢 **${e.name}** • ${e.role||'Employé'}\nDepuis : ${this.dt(e.serviceStartedAt)}\nProchain salaire : ${e.nextPayrollAt?this.dt(e.nextPayrollAt):'—'}`).join('\n\n'):'Aucun employé en service.').setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-service'){
      if(!interaction.options.getBoolean('confirmer')) return interaction.reply({content:'❌ Modification annulée : `confirmer` doit être activé.',ephemeral:true});
      const id=interaction.options.getString('employe'), action=interaction.options.getString('action'); const emp=arr(state.employees).find(e=>String(e.id)===id);
      if(!emp) return interaction.reply({content:'❌ Employé introuvable.',ephemeral:true});
      if(action==='start' && emp.inService) return interaction.reply({content:`ℹ️ ${emp.name} est déjà en service.`,ephemeral:true});
      if(action==='stop' && !emp.inService) return interaction.reply({content:`ℹ️ ${emp.name} est déjà hors service.`,ephemeral:true});
      await interaction.deferReply({ephemeral:true});
      const actor=this.actor(interaction), now=Date.now();
      await this.mutate(actor,'Service Discord',`${emp.name} ${action==='start'?'prend':'termine'} son service depuis Discord`,s=>{
        const e=arr(s.employees).find(x=>String(x.id)===id); if(!e) return;
        if(action==='start'){ e.inService=true; e.serviceStartedAt=new Date(now).toISOString(); e.nextPayrollAt=new Date(now+Math.max(1,n(e.payrollIntervalMinutes)||60)*60000).toISOString(); }
        else { e.inService=false; e.serviceStartedAt=null; e.nextPayrollAt=null; }
      });
      return interaction.editReply(`✅ Service de **${emp.name}** ${action==='start'?'démarré':'terminé'}.`);
    }

    if(cmd==='rex-stock'){
      const filter=interaction.options.getString('filtre')||'alerts', threshold=Math.max(0,n(state.lowStockThreshold)); let list=arr(state.products).slice();
      if(filter==='alerts') list=list.filter(p=>n(p.stock)<=threshold); if(filter==='out') list=list.filter(p=>n(p.stock)<=0); list.sort((a,b)=>n(a.stock)-n(b.stock));
      const text=list.length?list.map(p=>`${n(p.stock)<=0?'🔴':n(p.stock)<=threshold?'🟠':'🟢'} ${p.icon||'📦'} **${p.name}** — ${n(p.stock)}`).join('\n'):'🟢 Aucun produit correspondant.';
      return interaction.reply({embeds:[new EmbedBuilder().setColor(list.some(p=>n(p.stock)<=0)?COLORS.danger:COLORS.stock).setTitle('📦 État des stocks').setDescription(truncate(text,4000)).setFooter({text:`Seuil stock faible : ${threshold}`}).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-stock-ajuster'){
      if(!interaction.options.getBoolean('confirmer')) return interaction.reply({content:'❌ Modification annulée : `confirmer` doit être activé.',ephemeral:true});
      const id=interaction.options.getString('produit'), mode=interaction.options.getString('mode'), qty=interaction.options.getInteger('quantite'), reason=interaction.options.getString('raison')||'Ajustement depuis Discord';
      const p=arr(state.products).find(x=>String(x.id)===id); if(!p) return interaction.reply({content:'❌ Produit introuvable.',ephemeral:true});
      const before=n(p.stock); const after=mode==='set'?qty:mode==='remove'?Math.max(0,before-qty):before+qty;
      await interaction.deferReply({ephemeral:true});
      await this.mutate(this.actor(interaction),'Stock Discord',`${p.name} • ${before} → ${after} • ${reason}`,s=>{ const x=arr(s.products).find(v=>String(v.id)===id); if(x) x.stock=after; });
      return interaction.editReply(`✅ **${p.name}** : stock **${before} → ${after}**.`);
    }

    if(cmd==='rex-caisse'){
      const moves=arr(state.drawerMovements).slice(0,8); const desc=moves.length?moves.map(m=>`${this.dt(m.date)} • **${m.reason||m.type}** • ${peso(m.after)}\n${m.employee||'Système'}`).join('\n\n'):'Aucun mouvement.';
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.cash).setTitle('🏦 Fond de caisse').addFields({name:'Solde actuel',value:peso(state.cashDrawerPesos),inline:true},{name:'Équivalent informatif',value:usd(n(state.cashDrawerPesos)/23),inline:true}).setDescription(truncate(desc,3500)).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-caisse-ajuster'){
      if(!this.cashAllowed(interaction)) return interaction.reply({content:'⛔ Les ajustements de caisse sont réservés aux administrateurs Discord.',ephemeral:true});
      if(!interaction.options.getBoolean('confirmer')) return interaction.reply({content:'❌ Modification annulée : `confirmer` doit être activé.',ephemeral:true});
      const mode=interaction.options.getString('mode'), amount=interaction.options.getNumber('montant'), currency=interaction.options.getString('devise'), reason=interaction.options.getString('raison');
      const mxn=currency==='USD'?amount*23:amount, before=n(state.cashDrawerPesos), after=mode==='set'?mxn:mode==='remove'?Math.max(0,before-mxn):before+mxn;
      await interaction.deferReply({ephemeral:true});
      const actor=this.actor(interaction);
      await this.mutate(actor,'Fonds de caisse Discord',`${peso(before)} → ${peso(after)} • ${reason}`,s=>{
        s.cashDrawerPesos=after; if(!Array.isArray(s.drawerMovements)) s.drawerMovements=[];
        s.drawerMovements.unshift({id:Date.now()+Math.random(),date:new Date().toISOString(),employee:actor,currency:'MXN',type:mode,amount:Math.abs(after-before),before,after,reason,originalCurrency:currency,originalAmount:amount});
        s.drawerMovements=s.drawerMovements.slice(0,500);
      });
      return interaction.editReply(`✅ Fond de caisse : **${peso(before)} → ${peso(after)}**.`);
    }

    if(cmd==='rex-commandes'){
      const limit=interaction.options.getInteger('limite')||5, orders=arr(state.supplyOrders).slice(0,limit);
      const desc=orders.length?orders.map(o=>`**${o.id}** • ${this.dt(o.date)}\n👤 ${o.employee} • ${peso(o.totalPesos)} • ${arr(o.items).length} matière(s)${arr(o.recipes).length?` • ${arr(o.recipes).length} recette(s)`:''}`).join('\n\n'):'Aucune commande de matières.';
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.warning).setTitle('🚚 Commandes de matières').setDescription(truncate(desc,4000)).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-rapport'){
      const period=interaction.options.getString('periode'), publish=interaction.options.getBoolean('publier')||false, e=this.statsEmbed(state,period,null,'📑 Rapport Rex’s Diner');
      if(publish){ await this.sendEmbed('reports',e); return interaction.reply({content:'✅ Rapport publié dans `#rex-rapports`.',ephemeral:true}); }
      return interaction.reply({embeds:[e],ephemeral:true});
    }

    if(cmd==='rex-config'){
      const chans=Object.entries(this.channelIds).filter(([,v])=>v).map(([k,v])=>`**${k}** : <#${v}>`).join('\n');
      return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.admin).setTitle('⚙️ Configuration du bot Rex').addFields(
        {name:'Auto setup',value:this.autoSetup?'✅ Actif':'❌ Inactif',inline:true},{name:'Alertes stock faible',value:this.alertLowStock?'✅ Actives':'❌ Ruptures seulement',inline:true},{name:'Caisse pour rôles',value:this.allowCashForRoles?'⚠️ Autorisée':'🔒 Admin uniquement',inline:true},
        {name:'Rapport quotidien',value:this.dailyReportTime,inline:true},{name:'Rapport hebdomadaire',value:`Jour ${this.weeklyReportDay} • ${this.weeklyReportTime}`,inline:true},{name:'Fuseau',value:this.timeZone,inline:true},
        {name:'Salons',value:truncate(chans||'Aucun salon configuré',1024)}
      ).setTimestamp()],ephemeral:true});
    }

    if(cmd==='rex-test'){
      await interaction.reply({content:'✅ Test envoyé dans `#rex-systeme` et `#rex-alertes`.',ephemeral:true});
      await this.sendEmbed('system',new EmbedBuilder().setColor(COLORS.info).setTitle('🧪 Test du bot Rex').setDescription(`Test lancé par **${interaction.user.tag}**. Connexion, file d’envoi et embeds opérationnels.`).setTimestamp());
      return this.sendEmbed('alerts',new EmbedBuilder().setColor(COLORS.success).setTitle('✅ Test alertes').setDescription('Le salon d’alertes fonctionne correctement.').setTimestamp());
    }

    return interaction.reply({embeds:[new EmbedBuilder().setColor(COLORS.info).setTitle('🦖 Rex Bot • Aide').setDescription([
      '**Consultation**', '`/rex-dashboard` — tableau de bord', '`/rex-status` — état du site/bot', '`/rex-stats` — statistiques par période/employé', '`/rex-ventes` — ventes détaillées', '`/rex-services` — employés en service', '`/rex-stock` — stocks', '`/rex-caisse` — caisse', '`/rex-commandes` — commandes matières',
      '', '**Gestion depuis Discord**', '`/rex-service` — démarrer/terminer un service', '`/rex-stock-ajuster` — ajuster un produit', '`/rex-caisse-ajuster` — ajuster la caisse (admin)',
      '', '**Rapports & système**', '`/rex-rapport` — générer/publier un rapport', '`/rex-config` — configuration', '`/rex-test` — test complet', '`/rex-help` — cette aide'
    ].join('\n')).setFooter({text:'Toutes les modifications Discord sont journalisées sur le site.'})],ephemeral:true});
  }

  async markReportSent(key){
    if(typeof this.mutateState!=='function') return;
    await this.mutateState({actor:'Système Discord',action:null,detail:null,silent:true,mutator:s=>{
      if(!s.discordBotMeta || typeof s.discordBotMeta!=='object') s.discordBotMeta={};
      if(!Array.isArray(s.discordBotMeta.reportKeys)) s.discordBotMeta.reportKeys=[];
      if(!s.discordBotMeta.reportKeys.includes(key)) s.discordBotMeta.reportKeys.unshift(key);
      s.discordBotMeta.reportKeys=s.discordBotMeta.reportKeys.slice(0,90);
    }});
  }

  async runScheduledReports(){
    if(!this.ready) return; const state=this.getState()||{}; const lp=this.localParts(); const hhmm=`${lp.hour}:${lp.minute}`;
    const keys=arr(state.discordBotMeta?.reportKeys);
    if(hhmm===this.dailyReportTime){
      const key=`daily:${lp.date}`; if(!keys.includes(key)){
        await this.sendEmbed('reports',this.statsEmbed(state,'today',null,'🌙 Rapport quotidien Rex’s Diner'));
        await this.markReportSent(key);
      }
    }
    if(lp.weekday===this.weeklyReportDay && hhmm===this.weeklyReportTime){
      const key=`weekly:${lp.date}`; if(!keys.includes(key)){
        await this.sendEmbed('reports',this.statsEmbed(state,'7d',null,'📅 Rapport hebdomadaire Rex’s Diner'));
        await this.markReportSent(key);
      }
    }
  }
}

module.exports = { RexDiscordBot };
