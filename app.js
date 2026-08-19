(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const EXCHANGE_RATE=23;
  const THEME_KEY='rexs_diner_theme';
  const money = n => '$'+new Intl.NumberFormat('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
  const peso = n => new Intl.NumberFormat('fr-BE',{maximumFractionDigits:2}).format(Number(n)||0)+' pesos';
  const toPesos = usd => (Number(usd)||0)*EXCHANGE_RATE;
  const toDollars = mxn => (Number(mxn)||0)/EXCHANGE_RATE;
  const currencyName = c => c==='MXN'?'Pesos':'Dollars';
  const currencyAmount = (amount,currency) => currency==='MXN'?peso(amount):money(amount);
  const nowISO = () => new Date().toISOString();
  const escapeHtml = value => { const d=document.createElement('div'); d.textContent=value ?? ''; return d.innerHTML; };

  const defaults = {
    products: [
      {id:1,name:'Classic Burger',category:'Burgers',price:12.90,stock:18,icon:'🍔'},
      {id:2,name:"Rex's Bacon Burger",category:'Burgers',price:14.90,stock:12,icon:'🥓'},
      {id:3,name:'Double Cheese',category:'Burgers',price:15.50,stock:8,icon:'🧀'},
      {id:4,name:'Frites maison',category:'Sides',price:4.50,stock:30,icon:'🍟'},
      {id:5,name:'Onion Rings',category:'Sides',price:5.50,stock:4,icon:'🧅'},
      {id:6,name:'Cola',category:'Boissons',price:3.50,stock:26,icon:'🥤'},
      {id:7,name:'Limonade',category:'Boissons',price:3.90,stock:14,icon:'🍋'},
      {id:8,name:'Milkshake Vanille',category:'Boissons',price:6.90,stock:7,icon:'🥛'},
      {id:9,name:'Milkshake Fraise',category:'Boissons',price:6.90,stock:3,icon:'🍓'},
      {id:10,name:'Cheesecake',category:'Desserts',price:7.50,stock:9,icon:'🍰'},
      {id:11,name:'Pancakes',category:'Desserts',price:8.90,stock:11,icon:'🥞'},
      {id:12,name:'Crêpes au sucre',category:'Desserts',price:7.90,stock:10,icon:'✨'}
    ],
    employees: [
      {id:1,name:'Jackson Teller',initials:'JT',role:'Patron',pin:'2580',active:true,lastLogin:null,salaryPesos:0,payrollIntervalMinutes:60,inService:false,serviceStartedAt:null,nextPayrollAt:null},
      {id:2,name:'Sarah Miller',initials:'SM',role:'Manager',pin:'1470',active:true,lastLogin:null,salaryPesos:0,payrollIntervalMinutes:60,inService:false,serviceStartedAt:null,nextPayrollAt:null},
      {id:3,name:'Mike Brown',initials:'MB',role:'Employé',pin:'1234',active:true,lastLogin:null,salaryPesos:0,payrollIntervalMinutes:60,inService:false,serviceStartedAt:null,nextPayrollAt:null}
    ],
    sales: [], journal: [], heldSales: [], drawerMovements: [],
    materials: [
      {id:101,name:'Viande hachée',supplier:'Los Santos Food Supply',unit:'kg',pricePesos:115},
      {id:102,name:'Pains burger',supplier:'Bakery Wholesale',unit:'carton',pricePesos:460},
      {id:103,name:'Fromage cheddar',supplier:'Los Santos Food Supply',unit:'lot',pricePesos:345},
      {id:104,name:'Pommes de terre',supplier:'Fresh Produce Co.',unit:'sac',pricePesos:230},
      {id:105,name:'Boissons gazeuses',supplier:'Beverage Distribution',unit:'caisse',pricePesos:575},
      {id:106,name:'Glace vanille',supplier:'Dairy & Desserts',unit:'litre',pricePesos:92}
    ],
    productCategories: ['Burgers','Sides','Boissons','Desserts','Autres'],
    discounts: [
      {id:1,name:'5 %',percent:5},{id:2,name:'10 %',percent:10},{id:3,name:'15 %',percent:15},{id:4,name:'20 %',percent:20}
    ],
    rolePermissions: {
      'Employé': {dashboard:true,pos:true,stock:false,supplies:false,sales:false,drawer:false,journal:false,settings:false,employees:false,adjustDrawer:false,manageStock:false,manageSupplies:false,clearSales:false,clearJournal:false},
      'Manager': {dashboard:true,pos:true,stock:true,supplies:true,sales:true,drawer:true,journal:true,settings:false,employees:false,adjustDrawer:true,manageStock:true,manageSupplies:true,clearSales:false,clearJournal:false},
      'Patron': {dashboard:true,pos:true,stock:true,supplies:true,sales:true,drawer:true,journal:true,settings:true,employees:true,adjustDrawer:true,manageStock:true,manageSupplies:true,clearSales:true,clearJournal:true}
    },
    supplyOrders: [], payrollTransactions:[], payrollAppliedTotalPesos:0, cashDrawerPesos:0, exchangeRate:EXCHANGE_RATE, lowStockThreshold:5, taxRate:10
  };

  const KEY='rexs_diner_pos_v10_cache';
  const OLD_KEY='rexs_diner_pos_v8_cache';
  function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
  function normalizeData(target){
    if(!target||typeof target!=='object')return target;
    if(!Array.isArray(target.products))target.products=[];
    if(!Array.isArray(target.materials))target.materials=[];
    const usedCategories=[...new Set(target.products.map(p=>String(p.category||'Autres').trim()||'Autres'))];
    const baseCategories=Array.isArray(target.productCategories)?target.productCategories.map(c=>String(c||'').trim()).filter(Boolean):[];
    target.productCategories=[...new Set([...baseCategories,...usedCategories])];
    if(!target.productCategories.length)target.productCategories=['Autres'];
    if(!Array.isArray(target.discounts)) target.discounts=fresh().discounts;
    if(!Array.isArray(target.employees)) target.employees=[];
    const defaultPerms=fresh().rolePermissions;
    if(!target.rolePermissions||typeof target.rolePermissions!=='object')target.rolePermissions={};
    ['Employé','Manager','Patron'].forEach(role=>{target.rolePermissions[role]={...defaultPerms[role],...(target.rolePermissions[role]||{})};});
    target.rolePermissions.Patron={...defaultPerms.Patron};
    target.employees.forEach(e=>{
      e.salaryPesos=Math.max(0,Number(e.salaryPesos)||0);
      e.payrollIntervalMinutes=Math.max(1,Number(e.payrollIntervalMinutes)||60);
      e.inService=!!e.inService;
      e.serviceStartedAt=e.serviceStartedAt||null;
      e.nextPayrollAt=e.nextPayrollAt||null;
    });
    target.payrollAppliedTotalPesos=Math.max(0,Number(target.payrollAppliedTotalPesos)||0);
    if(!Array.isArray(target.payrollTransactions))target.payrollTransactions=[];
    target.discounts=target.discounts.map((d,i)=>({id:d?.id ?? (Date.now()+i),name:String(d?.name||((Number(d?.percent)||0)+' %')).trim(),percent:Math.min(100,Math.max(0,Number(d?.percent)||0))})).filter(d=>d.name&&d.percent>0);
    return target;
  }
  function load(){
    try {
      const raw=localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY); if(!raw) return fresh();
      const parsed=JSON.parse(raw); const merged={...fresh(),...parsed};
      if(Number.isFinite(Number(parsed.cashDrawerPesos))) merged.cashDrawerPesos=Number(parsed.cashDrawerPesos);
      else if(parsed.cashDrawer) merged.cashDrawerPesos=Number(parsed.cashDrawer.MXN||0)+toPesos(Number(parsed.cashDrawer.USD||0));
      if(!Array.isArray(merged.drawerMovements))merged.drawerMovements=[];
      if(!Array.isArray(merged.materials))merged.materials=fresh().materials;
      if(!Array.isArray(merged.supplyOrders))merged.supplyOrders=[];
      merged.drawerMovements=merged.drawerMovements.map(m=>{
        if(m.currency==='USD') return {...m,originalCurrency:'USD',originalAmount:Number(m.amount)||0,currency:'MXN',amount:toPesos(m.amount),before:toPesos(m.before),after:toPesos(m.after)};
        return {...m,currency:'MXN'};
      });
      merged.exchangeRate=EXCHANGE_RATE; return normalizeData(merged);
    }
    catch { return normalizeData(fresh()); }
  }
  const data=normalizeData(load());
  const sync={
    ready:false,connected:false,revision:0,
    clientId:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random()),
    sending:false,pending:false,suppress:false,eventSource:null,
    sseConnected:false,pollConnected:false,pollTimer:null,reconnectTimer:null,
    lastServerContact:0,lastAppliedRevision:0
  };
  const state={currentUser:null,loginUserId:null,pin:'',view:'dashboard',category:'Tous',productSearch:'',stockSearch:'',stockFilter:'all',salesSearch:'',journalSearch:'',materialSearch:'',supplyDraft:[],supplyNote:'',cart:[],orderNote:'',discount:0,stockTarget:null,stockMode:'add',confirmAction:null,paymentCurrency:'USD',drawerMode:'add',pendingCheckoutMethod:null,pendingCheckoutCurrency:null};
  function save(){
    localStorage.setItem(KEY,JSON.stringify(data));
    if(!sync.ready || sync.suppress){ return; }
    queueServerSave();
  }
  function setSyncStatus(mode,text){
    const el=$('#realtimeStatus'); if(!el)return;
    el.className='realtime-status '+mode;
    const span=el.querySelector('span'); if(span)span.textContent=text;
    const s=$('#settingsSyncState'); if(s)s.textContent=text;
    const r=$('#settingsRevision'); if(r)r.textContent=String(sync.revision||0);
  }
  function refreshSyncBadge(){
    const healthy = sync.sseConnected || sync.pollConnected;
    sync.connected = healthy;
    if(sync.sseConnected){
      sync.lastServerContact=Date.now();refreshSyncBadge();
    }else if(sync.pollConnected){
      setSyncStatus('online','Synchronisation active');
    }else if(sync.ready){
      setSyncStatus('offline','Reconnexion…');
    }else{
      setSyncStatus('connecting','Connexion…');
    }
  }
  async function queueServerSave(){
    if(sync.sending){ sync.pending=true; return; }
    sync.sending=true;
    try{
      const res=await fetch('/api/state',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({clientId:sync.clientId,data})
      });
      if(!res.ok) throw new Error('sync');
      const payload=await res.json();
      if(payload.revision)sync.revision=payload.revision;
      sync.pollConnected=true;sync.lastServerContact=Date.now();refreshSyncBadge();
    }catch(err){
      sync.pollConnected=false;refreshSyncBadge();
    }finally{
      sync.sending=false;
      if(sync.pending){sync.pending=false;queueServerSave();}
    }
  }
  function applyRemoteData(remote,revision){
    if(!remote||typeof remote!=='object')return;
    const userId=state.currentUser?.id;
    sync.suppress=true;
    Object.keys(data).forEach(k=>delete data[k]);
    Object.assign(data,fresh(),remote);
    normalizeData(data);
    data.exchangeRate=EXCHANGE_RATE;
    localStorage.setItem(KEY,JSON.stringify(data));
    if(userId){
      const refreshed=data.employees.find(e=>e.id===userId);
      if(refreshed&&refreshed.active){
        state.currentUser=refreshed;
        $('#headerInitials').textContent=refreshed.initials;
        $('#headerName').textContent=refreshed.name;
        $('#headerRole').textContent=refreshed.role;
        applyPermissions();
      }else{
        state.currentUser=null;
        $('#app').classList.add('hidden');
        $('#loginView').classList.remove('hidden');
      }
    }
    if(revision){
      sync.revision=Math.max(sync.revision||0,Number(revision)||0);
      sync.lastAppliedRevision=Math.max(sync.lastAppliedRevision||0,Number(revision)||0);
    }
    sync.suppress=false;
    renderLogin();renderAll();
    setSyncStatus('online','Temps réel connecté');
  }
  async function initRealtime(){
    setSyncStatus('connecting','Connexion…');
    try{
      const res=await fetch('/api/state',{cache:'no-store'});
      if(!res.ok)throw new Error('state');
      const payload=await res.json();
      if(payload.initialized && payload.data){
        applyRemoteData(payload.data,payload.revision||0);
      }else{
        const boot=await fetch('/api/bootstrap',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({clientId:sync.clientId,data})
        });
        if(!boot.ok)throw new Error('bootstrap');
        const bp=await boot.json();
        if(bp.data)applyRemoteData(bp.data,bp.revision||1);
      }
      sync.ready=true;
      sync.pollConnected=true;
      sync.lastServerContact=Date.now();
      refreshSyncBadge();
      startPolling();
      connectEvents();
    }catch(err){
      sync.ready=false;
      sync.pollConnected=false;
      sync.sseConnected=false;
      refreshSyncBadge();
      clearTimeout(sync.reconnectTimer);
      sync.reconnectTimer=setTimeout(initRealtime,2500);
    }
  }

  async function pollServer(force=false){
    if(!sync.ready && !force)return;
    try{
      const res=await fetch('/api/state?since='+encodeURIComponent(sync.revision||0),{
        cache:'no-store',
        headers:{'X-Rex-Client':sync.clientId}
      });
      if(!res.ok)throw new Error('poll');
      const payload=await res.json();
      sync.pollConnected=true;
      sync.lastServerContact=Date.now();

      const serverRevision=Number(payload.revision||0);
      if(payload.changed && payload.data && serverRevision>Number(sync.revision||0)){
        applyRemoteData(payload.data,serverRevision);
      }else if(serverRevision>Number(sync.revision||0) && payload.data){
        applyRemoteData(payload.data,serverRevision);
      }else{
        sync.revision=Math.max(Number(sync.revision||0),serverRevision);
      }
      refreshSyncBadge();
    }catch(err){
      sync.pollConnected=false;
      refreshSyncBadge();
    }
  }

  function startPolling(){
    clearInterval(sync.pollTimer);
    // Fallback robuste : même si SSE est coupé, une autre caisse est détectée rapidement.
    sync.pollTimer=setInterval(()=>pollServer(false),1500);
    pollServer(true);
  }

  function scheduleSseReconnect(){
    clearTimeout(sync.reconnectTimer);
    sync.reconnectTimer=setTimeout(()=>{
      if(sync.ready)connectEvents();
    },2000);
  }

  function connectEvents(){
    if(sync.eventSource){
      try{sync.eventSource.close();}catch{}
      sync.eventSource=null;
    }
    const es=new EventSource('/api/events?clientId='+encodeURIComponent(sync.clientId));
    sync.eventSource=es;

    es.onopen=()=>{
      sync.sseConnected=true;
      sync.lastServerContact=Date.now();
      refreshSyncBadge();
    };

    es.onmessage=e=>{
      try{
        const msg=JSON.parse(e.data);
        sync.sseConnected=true;
        sync.lastServerContact=Date.now();

        if(msg.type==='state' && msg.clientId!==sync.clientId){
          const incomingRevision=Number(msg.revision||0);
          if(incomingRevision>Number(sync.revision||0)){
            applyRemoteData(msg.data,incomingRevision);
            toast('Mise à jour reçue d’une autre caisse');
          }
        }else if(msg.type==='hello'){
          const serverRevision=Number(msg.revision||0);
          if(serverRevision>Number(sync.revision||0))pollServer(true);
          sync.revision=Math.max(Number(sync.revision||0),serverRevision);
        }
        refreshSyncBadge();
      }catch{}
    };

    es.onerror=()=>{
      sync.sseConnected=false;
      try{es.close();}catch{}
      if(sync.eventSource===es)sync.eventSource=null;
      refreshSyncBadge();
      // On garde le polling actif et on retente SSE indépendamment.
      scheduleSseReconnect();
    };
  }

  window.addEventListener('focus',()=>pollServer(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')pollServer(true);
  });
  window.addEventListener('online',()=>{
    pollServer(true);
    connectEvents();
  });
  window.addEventListener('offline',()=>{
    sync.pollConnected=false;
    sync.sseConnected=false;
    refreshSyncBadge();
  });


  function getStoredTheme(){ return localStorage.getItem(THEME_KEY)||'light'; }
  function applyTheme(theme){
    const dark=theme==='dark';
    document.documentElement.classList.toggle('dark-theme',dark);
    document.documentElement.dataset.theme=dark?'dark':'light';
    const toggle=$('#darkThemeToggle');
    const label=$('#themeModeLabel');
    const desc=$('#themeModeDescription');
    if(toggle)toggle.checked=dark;
    if(label)label.textContent=dark?'Thème sombre':'Thème clair';
    if(desc)desc.textContent=dark?'Interface sombre':'Interface lumineuse';
    localStorage.setItem(THEME_KEY,dark?'dark':'light');
  }
  function toggleTheme(enabled){
    applyTheme(enabled?'dark':'light');
    toast(enabled?'Thème sombre activé':'Thème clair activé');
  }


  const CLIENT_BUILD='11.12.0';
  let buildCheckTimer=null;

  async function checkForNewBuild(force=false){
    try{
      const res=await fetch('/api/build?t='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache'}
      });
      if(!res.ok)return;
      const info=await res.json();
      if(info.build && info.build!==CLIENT_BUILD){
        sessionStorage.setItem('rex_build_reload',info.build);
        const url=new URL(window.location.href);
        url.searchParams.set('_build',info.build);
        window.location.replace(url.toString());
        return;
      }
      const el=$('#buildVersion');
      if(el)el.textContent=CLIENT_BUILD;
    }catch{}
  }

  function startBuildWatcher(){
    clearInterval(buildCheckTimer);
    checkForNewBuild(true);
    buildCheckTimer=setInterval(()=>checkForNewBuild(false),10000);
  }

  function roleLevel(role){ return role==='Patron'?3:role==='Manager'?2:1; }
  function can(level){ return !!state.currentUser && roleLevel(state.currentUser.role)>=level; }
  function hasPermission(key){
    if(!state.currentUser)return false;
    if(state.currentUser.role==='Patron')return true;
    return !!data.rolePermissions?.[state.currentUser.role]?.[key];
  }
  function requirePermission(key){ if(hasPermission(key))return true; toast('Accès refusé'); return false; }
  function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),1800); }
  function log(action,detail,user=state.currentUser){ data.journal.unshift({id:Date.now()+Math.random(),date:nowISO(),employee:user?.name||'Système',action,detail}); data.journal=data.journal.slice(0,500); save(); renderJournal(); }
  function statusFor(stock){ return stock<=0?{label:'Rupture',cls:'out'}:stock<=Number(data.lowStockThreshold)?{label:'Stock faible',cls:'low'}:{label:'Disponible',cls:'ok'}; }
  function formatDate(iso){ return iso?new Date(iso).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'Jamais'; }


  function formatCountdown(ms){
    ms=Math.max(0,Number(ms)||0); const total=Math.ceil(ms/1000); const h=Math.floor(total/3600); const m=Math.floor((total%3600)/60); const sec=total%60;
    return h?`${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`:`${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
  }
  function serviceCountdown(emp){ return emp?.inService&&emp.nextPayrollAt?formatCountdown(new Date(emp.nextPayrollAt).getTime()-Date.now()):'—'; }
  function renderMyService(){
    const host=$('#myServicePanel'); if(!host||!state.currentUser)return;
    const emp=data.employees.find(e=>e.id===state.currentUser.id); if(!emp)return;
    const active=!!emp.inService;
    host.innerHTML=`<div><span class="kicker">SERVICE & SALAIRE</span><h3>${active?'Service en cours':'Hors service'}</h3><p>${active?`Prochain salaire dans <strong data-service-countdown="${emp.id}">${serviceCountdown(emp)}</strong>.`:`Prends ton service pour démarrer ton minuteur de salaire.`}</p><small>Salaire : <b>${peso(emp.salaryPesos)}</b> toutes les <b>${Number(emp.payrollIntervalMinutes)} minute(s)</b>.</small></div><button type="button" id="toggleMyService" class="button ${active?'button-danger':'button-primary'}">${active?'Terminer mon service':'Prendre mon service'}</button>`;
    $('#toggleMyService').onclick=toggleMyService;
  }
  function toggleMyService(){
    const emp=data.employees.find(e=>e.id===state.currentUser?.id); if(!emp)return;
    const now=Date.now();
    if(emp.inService){ emp.inService=false; emp.serviceStartedAt=null; emp.nextPayrollAt=null; log('Service',`${emp.name} termine son service`,emp); toast('Service terminé'); }
    else { emp.inService=true; emp.serviceStartedAt=new Date(now).toISOString(); emp.nextPayrollAt=new Date(now+Math.max(1,Number(emp.payrollIntervalMinutes)||60)*60000).toISOString(); log('Service',`${emp.name} prend son service`,emp); toast('Service commencé'); }
    save(); renderMyService(); renderEmployees();
  }
  function refreshServiceCountdowns(){
    $$('[data-service-countdown]').forEach(el=>{const emp=data.employees.find(e=>e.id===Number(el.dataset.serviceCountdown)); if(emp)el.textContent=serviceCountdown(emp);});
  }

  function activeEmployees(){ return data.employees.filter(e=>e.active); }
  function renderLogin(){
    const users=activeEmployees();
    if(!users.length){ data.employees=fresh().employees; save(); }
    const list=activeEmployees();
    if(!list.some(e=>e.id===state.loginUserId)) state.loginUserId=list[0]?.id ?? null;
    $('#loginUsers').innerHTML=list.map(e=>`<button type="button" class="${e.id===state.loginUserId?'active':''}" data-login-user="${e.id}">${escapeHtml(e.name.split(' ')[0])}</button>`).join('');
    const user=data.employees.find(e=>e.id===state.loginUserId);
    $('#selectedLoginUser').innerHTML=user?`<span class="avatar">${escapeHtml(user.initials)}</span><span><b>${escapeHtml(user.name)}</b><small>${escapeHtml(user.role)}</small></span>`:'';
    $$('#loginUsers [data-login-user]').forEach(b=>b.onclick=()=>{ state.loginUserId=Number(b.dataset.loginUser); state.pin=''; renderPin(); renderLogin(); });
  }
  function renderPin(){ $$('#pinDisplay i').forEach((dot,i)=>dot.classList.toggle('filled',i<state.pin.length)); }
  function pressPin(digit){ if(state.pin.length>=4) return; state.pin+=digit; renderPin(); if(state.pin.length===4) setTimeout(attemptLogin,120); }
  function attemptLogin(){
    const user=data.employees.find(e=>e.id===state.loginUserId && e.active);
    if(user && user.pin===state.pin){ state.currentUser=user; user.lastLogin=nowISO(); state.pin=''; save(); log('Connexion','Connexion à la caisse',user); enterApp(); }
    else { state.pin=''; renderPin(); toast('Code PIN incorrect'); }
  }
  function enterApp(){
    $('#loginView').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#headerInitials').textContent=state.currentUser.initials; $('#headerName').textContent=state.currentUser.name; $('#headerRole').textContent=state.currentUser.role;
    $('#dashboardGreeting').textContent=`Bon service, ${state.currentUser.name.split(' ')[0]} !`;
    applyPermissions(); switchView('dashboard'); renderAll();
  }
  function lockApp(){ if(state.currentUser) log('Verrouillage','Caisse verrouillée'); state.currentUser=null; state.cart=[]; state.orderNote=''; state.discount=0; $('#app').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#userMenu').classList.add('hidden'); renderLogin(); renderPin(); }
  function logout(){ lockApp(); }
  function applyPermissions(){
    $$('#nav [data-view]').forEach(b=>b.classList.toggle('hidden',!hasPermission(b.dataset.view)));
    $$('.patron-only').forEach(el=>el.classList.toggle('hidden',!hasPermission(el.id==='clearSales'?'clearSales':el.id==='clearJournal'?'clearJournal':'employees')));
    const adjust=$('#adjustDrawer'); if(adjust)adjust.classList.toggle('hidden',!hasPermission('adjustDrawer'));
    ['addProduct'].forEach(id=>{const el=$('#'+id);if(el)el.classList.toggle('hidden',!hasPermission('manageStock'));});
    ['addMaterial','sortMaterialsAZ','submitSupplyOrder'].forEach(id=>{const el=$('#'+id);if(el)el.classList.toggle('hidden',!hasPermission('manageSupplies'));});
  }

  const viewMeta={dashboard:['TABLEAU DE BORD','Accueil'],pos:['CAISSE','Caisse enregistreuse'],stock:['INVENTAIRE','Gestion des stocks'],supplies:['APPROVISIONNEMENT','Matières premières'],sales:['ACTIVITÉ','Ventes'],drawer:['TRÉSORERIE','Fonds de caisse'],employees:['ÉQUIPE','Employés & permissions'],journal:['SÉCURITÉ','Journal d’activité'],settings:['CONFIGURATION','Réglages']};
  function switchView(view){
    const meta=viewMeta[view]; if(!meta) return; if(!hasPermission(view)){ toast('Accès refusé'); return; }
    state.view=view; $$('.view').forEach(v=>v.classList.remove('active')); $(`#view-${view}`).classList.add('active');
    $$('#nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); $('#viewKicker').textContent=meta[0]; $('#viewTitle').textContent=meta[1]; $('#userMenu').classList.add('hidden');
    if(view==='dashboard') renderDashboard(); if(view==='pos') renderPOS(); if(view==='stock') renderStock(); if(view==='supplies') renderSupplies(); if(view==='sales') renderSales(); if(view==='drawer') renderDrawer(); if(view==='employees') renderEmployees(); if(view==='journal') renderJournal();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function metric(icon,label,value,sub,cls=''){ return `<article class="metric ${cls}"><span class="metric-icon">${icon}</span><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(sub)}</small></div></article>`; }
  function revenue(){ return data.sales.reduce((s,x)=>s+Number(x.total||0),0); }
  function itemsSold(){ return data.sales.reduce((s,x)=>s+x.items.reduce((a,i)=>a+Number(i.qty||0),0),0); }
  function lowCount(){ return data.products.filter(p=>p.stock>0&&p.stock<=Number(data.lowStockThreshold)).length; }
  function outCount(){ return data.products.filter(p=>p.stock<=0).length; }
  function renderDashboard(){
    $('#dashboardMetrics').innerHTML=[
      metric('$','Chiffre d’affaires',money(revenue()),'total enregistré','teal'),
      metric('#','Tickets',data.sales.length,'commandes encaissées'),
      metric('!','Stock faible',lowCount(),'produits à surveiller',lowCount()?'warn':''),
      metric('×','Ruptures',outCount(),'produits indisponibles',outCount()?'danger':'')
    ].join('');
    const actions=[{label:'Nouvelle vente',sub:'Ouvrir la caisse',icon:'▣',view:'pos'},{label:'Gérer le stock',sub:'Quantités & produits',icon:'▦',view:'stock'},{label:'Commander matières',sub:'Achats en pesos',icon:'◈',view:'supplies'},{label:'Voir les ventes',sub:'Historique & chiffres',icon:'↗',view:'sales'},{label:'Fonds de caisse',sub:'Solde global en pesos',icon:'◫',view:'drawer'},{label:'Gérer l’équipe',sub:'Comptes & PIN',icon:'♟',view:'employees'}].filter(a=>hasPermission(a.view));
    $('#dashboardActions').innerHTML=actions.map(a=>`<button type="button" class="quick-action" data-dashboard-view="${a.view}"><span class="qa-icon">${a.icon}</span><span><b>${a.label}</b><small>${a.sub}</small></span></button>`).join('');
    $$('[data-dashboard-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.dashboardView));
    $('#stockHealthText').textContent=outCount()?`${outCount()} rupture(s) et ${lowCount()} stock(s) faible(s)`:(lowCount()?`${lowCount()} produit(s) à surveiller`:'Aucune alerte de stock');
    $('#recentSales').innerHTML=data.sales.length?data.sales.slice(0,5).map(s=>`<div class="compact-row"><div><b>${escapeHtml(s.id)}</b><small>${escapeHtml(s.employee)} • ${formatDate(s.date)}</small></div><strong>${money(s.total)}</strong></div>`).join(''):'<div class="empty-mini">Aucune vente pour le moment.</div>';
    const alerts=data.products.filter(p=>p.stock<=Number(data.lowStockThreshold)).sort((a,b)=>a.stock-b.stock).slice(0,5);
    $('#stockAlerts').innerHTML=alerts.length?alerts.map(p=>`<div class="compact-row"><div><b>${p.icon} ${escapeHtml(p.name)}</b><small>${escapeHtml(p.category)}</small></div><strong>${p.stock<=0?'Rupture':p.stock+' restant(s)'}</strong></div>`).join(''):'<div class="empty-mini">Tout est bon côté stock.</div>';
    renderCashOverview();
    renderMyService();
  }

  function categories(){ normalizeData(data); return ['Tous',...data.productCategories]; }
  function renderPOS(){ renderCategories(); renderProducts(); renderDiscountSelect(); renderCart(); }
  function renderCategories(){ $('#categoryTabs').innerHTML=categories().map(c=>`<button type="button" class="${state.category===c?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join(''); $$('[data-cat]').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;renderCategories();renderProducts();}); }
  function renderProducts(){
    const q=state.productSearch.trim().toLowerCase(); const list=data.products.filter(p=>(state.category==='Tous'||p.category===state.category)&&p.name.toLowerCase().includes(q));
    $('#productGrid').innerHTML=list.length?list.map(p=>{const st=statusFor(p.stock);return `<button type="button" class="product-card ${p.stock<=0?'out':''}" data-add-product="${p.id}" ${p.stock<=0?'disabled':''}><div class="emoji">${p.icon||'🍽️'}</div><h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.category)}</p><div class="product-bottom"><b>${money(p.price)}</b><span class="stock-badge ${st.cls}">${p.stock<=0?'Rupture':p.stock+' dispo.'}</span></div></button>`}).join(''):'<div class="empty-mini">Aucun produit trouvé.</div>';
    $$('[data-add-product]').forEach(b=>b.onclick=()=>addToCart(Number(b.dataset.addProduct)));
  }
  function addToCart(id){ const p=data.products.find(x=>x.id===id); if(!p||p.stock<=0) return; const item=state.cart.find(x=>x.id===id); if((item?.qty||0)>=p.stock){toast('Stock maximum atteint');return;} if(item)item.qty++; else state.cart.push({id:p.id,name:p.name,price:p.price,qty:1}); renderCart(); }
  function changeQty(id,delta){ const item=state.cart.find(x=>x.id===id); const p=data.products.find(x=>x.id===id); if(!item||!p)return; if(delta>0&&item.qty>=p.stock){toast('Stock insuffisant');return;} item.qty+=delta; if(item.qty<=0)state.cart=state.cart.filter(x=>x.id!==id); renderCart(); }
  function renderDiscountSelect(){
    const select=$('#discountSelect'); if(!select)return; normalizeData(data);
    const current=Number(state.discount)||0;
    select.innerHTML='<option value="0">Aucune</option>'+data.discounts.map(d=>`<option value="${d.percent}">${escapeHtml(d.name)} (${Number(d.percent)} %)</option>`).join('');
    if(current>0&&!data.discounts.some(d=>Number(d.percent)===current)) select.innerHTML+=`<option value="${current}">${current} %</option>`;
    select.value=String(current);
  }
  function renderDiscountManager(){
    const host=$('#discountManagerList'); if(!host)return; normalizeData(data);
    host.innerHTML=data.discounts.length?data.discounts.map((d,index)=>`<div class="discount-manager-row">
      <input type="text" value="${escapeHtml(d.name)}" maxlength="40" data-discount-name="${index}" aria-label="Nom de la remise" />
      <div class="discount-percent-field"><input type="number" min="0.1" max="100" step="0.1" value="${Number(d.percent)}" data-discount-percent="${index}" aria-label="Pourcentage" /><span>%</span></div>
      <button type="button" class="table-action danger" data-discount-delete="${index}">Supprimer</button>
    </div>`).join(''):'<div class="empty-mini">Aucune remise personnalisée.</div>';
    $$('[data-discount-name]').forEach(x=>x.onchange=()=>updateDiscount(Number(x.dataset.discountName),'name',x.value));
    $$('[data-discount-percent]').forEach(x=>x.onchange=()=>updateDiscount(Number(x.dataset.discountPercent),'percent',x.value));
    $$('[data-discount-delete]').forEach(x=>x.onclick=()=>deleteDiscount(Number(x.dataset.discountDelete)));
  }
  function addDiscount(){
    if(!can(3)){toast('Accès refusé');return;} normalizeData(data);
    data.discounts.push({id:Date.now(),name:'Nouvelle remise',percent:10}); save(); log('Remises','Nouvelle remise créée'); renderAll(); toast('Remise ajoutée');
  }
  function updateDiscount(index,field,value){
    if(!can(3)){toast('Accès refusé');renderDiscountManager();return;} const d=data.discounts[index]; if(!d)return;
    if(field==='name'){value=String(value||'').trim();if(!value){toast('Le nom ne peut pas être vide');renderDiscountManager();return;}d.name=value;}
    else {value=Number(value);if(!Number.isFinite(value)||value<=0||value>100){toast('Le pourcentage doit être entre 0,1 et 100');renderDiscountManager();return;}d.percent=Math.round(value*10)/10;}
    save();log('Remises',`${d.name} : ${d.percent}%`);renderAll();toast('Remise enregistrée');
  }
  function deleteDiscount(index){
    if(!can(3)){toast('Accès refusé');return;} const d=data.discounts[index];if(!d)return;
    confirmAction('Supprimer cette remise ?',`${d.name} (${d.percent} %) sera retirée de la caisse.`,()=>{data.discounts.splice(index,1);if(Number(state.discount)===Number(d.percent))state.discount=0;save();log('Remises',`${d.name} supprimée`);renderAll();toast('Remise supprimée');});
  }
  function calcTotals(){ const subtotal=state.cart.reduce((s,i)=>s+i.price*i.qty,0); const discount=subtotal*(Number(state.discount)/100); const total=Math.max(0,subtotal-discount); const tax=total-(total/(1+Number(data.taxRate)/100)); return{subtotal,discount,total,tax}; }
  function renderCart(){
    const count=state.cart.reduce((s,i)=>s+i.qty,0); $('#ticketItemCount').textContent=`${count} article${count>1?'s':''}`;
    $('#cartItems').innerHTML=state.cart.length?state.cart.map(i=>`<div class="cart-row"><div><h4>${escapeHtml(i.name)}</h4><small>${money(i.price)} / unité</small><div class="qty"><button type="button" data-cart-id="${i.id}" data-delta="-1">−</button><b>${i.qty}</b><button type="button" data-cart-id="${i.id}" data-delta="1">+</button></div></div><div class="cart-price">${money(i.price*i.qty)}</div></div>`).join(''):'<div class="empty-cart"><div><span class="big">🧾</span><b>Ticket vide</b><br>Ajoute un produit pour commencer.</div></div>';
    $$('[data-cart-id]').forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.cartId),Number(b.dataset.delta)));
    const t=calcTotals(); const usePesos=state.paymentCurrency==='MXN'; $('#subtotal').textContent=usePesos?peso(toPesos(t.subtotal)):money(t.subtotal); $('#discountAmount').textContent=`− ${usePesos?peso(toPesos(t.discount)):money(t.discount)}`; $('#taxAmount').textContent=usePesos?peso(toPesos(t.tax)):money(t.tax); $('#total').textContent=usePesos?peso(toPesos(t.total)):money(t.total); $('#convertedTotal').textContent=usePesos?money(t.total):peso(toPesos(t.total)); $$('.payment').forEach(b=>b.disabled=!state.cart.length); $('#holdSale').disabled=!state.cart.length;
  }

  function openOrderConfirmation(method='Espèces'){
    if(!state.cart.length){toast('Le ticket est vide');return;}
    const t=calcTotals();

    state.pendingCheckoutMethod='Espèces';
    state.pendingCheckoutCurrency=state.paymentCurrency||'USD';

    const count=state.cart.reduce((s,i)=>s+Number(i.qty||0),0);
    $('#orderConfirmCount').textContent=String(count);

    const usePesosForItems=state.pendingCheckoutCurrency==='MXN';
    $('#orderConfirmItems').innerHTML=state.cart.map(i=>`
      <div class="order-confirm-item">
        <div>
          <strong>${escapeHtml(i.name)}</strong>
          <small>${i.qty} × ${usePesosForItems?peso(toPesos(i.price)):money(i.price)}</small>
        </div>
        <b>${usePesosForItems?peso(toPesos(i.price*i.qty)):money(i.price*i.qty)}</b>
      </div>`).join('');

    const currency=state.pendingCheckoutCurrency;
    const usePesos=currency==='MXN';

    $('#orderConfirmSubtotal').textContent=usePesos?peso(toPesos(t.subtotal)):money(t.subtotal);

    const discountValue=Math.max(0,Number(t.discount||0));
    $('#orderConfirmDiscount').textContent=discountValue>0
      ? `− ${usePesos?peso(toPesos(discountValue)):money(discountValue)}`
      : (usePesos?peso(0):money(0));

    $('#orderConfirmTotal').textContent=usePesos?peso(toPesos(t.total)):money(t.total);

    const paymentText=currency==='USD'
      ? `Paiement en espèces • ${money(t.total)} = ${peso(toPesos(t.total))}`
      : `Paiement en espèces • ${peso(toPesos(t.total))}`;

    $('#orderConfirmPaymentText').textContent=paymentText;
    openDialog('orderConfirmDialog');
  }

  function confirmAndCheckout(e){
    e.preventDefault();

    if(!state.cart.length){
      closeDialog('orderConfirmDialog');
      toast('Le ticket est vide');
      return;
    }

    state.pendingCheckoutMethod=null;
    closeDialog('orderConfirmDialog');

    // L'encaissement réel est effectué uniquement ici, après confirmation.
    checkout('Espèces');
  }

  function checkout(method){
    method='Espèces';
    if(!state.cart.length)return; for(const item of state.cart){const p=data.products.find(x=>x.id===item.id);if(!p||p.stock<item.qty){toast(`Stock insuffisant : ${item.name}`);return;}}
    const t=calcTotals(); state.cart.forEach(item=>data.products.find(x=>x.id===item.id).stock-=item.qty);
    const currency=state.paymentCurrency; const paidTotal=currency==='MXN'?toPesos(t.total):t.total;
    const sale={id:'RX-'+String(Date.now()).slice(-6),date:nowISO(),employee:state.currentUser.name,employeeId:state.currentUser.id,method,currency,paidTotal,exchangeRate:EXCHANGE_RATE,note:state.orderNote.trim(),discount:Number(state.discount),subtotal:t.subtotal,total:t.total,tax:t.tax,items:state.cart.map(i=>({...i}))};
    if(method==='Espèces'){
      const creditedPesos=currency==='MXN'?paidTotal:toPesos(paidTotal);
      const before=Number(data.cashDrawerPesos||0); data.cashDrawerPesos=before+creditedPesos;
      recordDrawerMovement('sale',creditedPesos,before,data.cashDrawerPesos,`Vente ${sale.id} • payée en ${currencyName(currency)}`,currency,paidTotal);
    }
    data.sales.unshift(sale); save(); log('Vente',`${sale.id} • ${currencyAmount(paidTotal,currency)} • ${method} • ${currencyName(currency)}`); state.cart=[];state.orderNote='';state.discount=0;$('#orderNote').value='';$('#discountSelect').value='0';renderAll();toast(`Vente ${sale.id} encaissée`); }
  function holdSale(){ if(!state.cart.length)return; data.heldSales.unshift({id:'ATT-'+String(Date.now()).slice(-5),date:nowISO(),employee:state.currentUser.name,note:state.orderNote,discount:state.discount,items:state.cart.map(i=>({...i}))}); save(); log('Vente en attente',`${data.heldSales[0].id} • ${state.cart.reduce((s,i)=>s+i.qty,0)} article(s)`); state.cart=[];state.orderNote='';state.discount=0;$('#orderNote').value='';$('#discountSelect').value='0';renderCart();toast('Commande mise en attente'); }
  function showReceipt(sale){
    const lines=sale.items.map(i=>`<div class="receipt-line"><span>${i.qty} × ${escapeHtml(i.name)}</span><b>${money(i.qty*i.price)}</b></div>`).join('');
    $('#receiptContent').innerHTML=`<div class="receipt-head"><div class="logo">REX'S DINER</div><small>Merci et à bientôt !</small></div><div class="receipt-meta"><span>Ticket</span><b>${sale.id}</b><span>Date</span><b>${formatDate(sale.date)}</b><span>Employé</span><b>${escapeHtml(sale.employee)}</b><span>Paiement</span><b>${escapeHtml(sale.method)} • ${currencyName(sale.currency||'USD')}</b></div><div class="receipt-lines">${lines}</div>${sale.discount?`<div class="receipt-line"><span>Remise ${sale.discount}%</span><b>− ${money(sale.subtotal-sale.total)}</b></div>`:''}<div class="receipt-total-line"><span>TOTAL</span><span>${currencyAmount(sale.paidTotal ?? (sale.currency==='MXN'?toPesos(sale.total):sale.total),sale.currency||'USD')}</span></div><div class="receipt-line receipt-conversion"><span>Équivalent</span><b>${sale.currency==='MXN'?money(sale.total):peso(toPesos(sale.total))}</b></div>${sale.note?`<div class="receipt-note">Note : ${escapeHtml(sale.note)}</div>`:''}`;
    openDialog('receiptDialog');
  }

  function renderStock(){
    $('#stockMetrics').innerHTML=[metric('▦','Produits',data.products.length,'références'),metric('!','Stock faible',lowCount(),'à surveiller',lowCount()?'warn':''),metric('×','Ruptures',outCount(),'indisponibles',outCount()?'danger':''),metric('$','Valeur stock',money(data.products.reduce((s,p)=>s+p.price*p.stock,0)),'prix de vente','teal')].join('');
    const q=state.stockSearch.toLowerCase().trim(); let list=data.products.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)); if(state.stockFilter==='low')list=list.filter(p=>p.stock>0&&p.stock<=Number(data.lowStockThreshold)); if(state.stockFilter==='out')list=list.filter(p=>p.stock<=0);
    $('#stockTable').innerHTML=list.length?list.map(p=>{const st=statusFor(p.stock);return `<tr><td><div class="product-cell"><span class="cell-icon">${p.icon||'🍽️'}</span><b>${escapeHtml(p.name)}</b></div></td><td>${escapeHtml(p.category)}</td><td>${money(p.price)}</td><td><b>${p.stock}</b></td><td><span class="status ${st.cls}">${st.label}</span></td><td class="right">${hasPermission('manageStock')?`<div class="table-actions"><button type="button" class="table-action stock" data-stock="${p.id}">± Stock</button><button type="button" class="table-action edit" data-edit-product="${p.id}">Modifier</button><button type="button" class="table-action danger" data-delete-product="${p.id}">Supprimer</button></div>`:'<span class="muted">Lecture seule</span>'}</td></tr>`}).join(''):'<tr><td colspan="6" class="empty-table">Aucun produit trouvé.</td></tr>';
    $$('[data-stock]').forEach(b=>b.onclick=()=>openStockDialog(Number(b.dataset.stock))); $$('[data-edit-product]').forEach(b=>b.onclick=()=>openProductDialog(Number(b.dataset.editProduct))); $$('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(Number(b.dataset.deleteProduct)));
  }
  function refreshProductCategorySelect(selected=null){
    normalizeData(data);
    const select=$('#productCategory'); if(!select)return;
    select.innerHTML=data.productCategories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    const wanted=selected||data.productCategories[0]||'Autres';
    if(!data.productCategories.includes(wanted)){data.productCategories.push(wanted);select.innerHTML+=`<option value="${escapeHtml(wanted)}">${escapeHtml(wanted)}</option>`;}
    select.value=wanted;
  }
  function openProductDialog(id=null){ if(!hasPermission('manageStock')){toast('Accès refusé');return;} const p=id?data.products.find(x=>x.id===id):null; $('#productDialogTitle').textContent=p?'Modifier le produit':'Ajouter un produit'; $('#productId').value=p?.id||''; $('#productName').value=p?.name||''; refreshProductCategorySelect(p?.category||data.productCategories[0]); $('#productPrice').value=p?.price??''; $('#productStock').value=p?.stock??0; $('#productIcon').value=p?.icon||'🍽️'; openDialog('productDialog'); setTimeout(()=>$('#productName').focus(),50); }
  function saveProduct(e){ e.preventDefault(); const id=Number($('#productId').value)||null; const product={name:$('#productName').value.trim(),category:$('#productCategory').value,price:Number($('#productPrice').value),stock:Math.max(0,Math.floor(Number($('#productStock').value))),icon:$('#productIcon').value.trim()||'🍽️'}; if(!product.name||!Number.isFinite(product.price)||product.price<0){toast('Vérifie les informations');return;} if(id){Object.assign(data.products.find(p=>p.id===id),product);log('Produit',`${product.name} modifié`);}else{product.id=Date.now();data.products.push(product);log('Produit',`${product.name} ajouté`);}save();closeDialog('productDialog');renderAll();toast(id?'Produit modifié':'Produit ajouté'); }
  function deleteProduct(id){ if(!hasPermission('manageStock')){toast('Accès refusé');return;} const p=data.products.find(x=>x.id===id); if(!p)return; confirmAction('Supprimer ce produit ?',`${p.name} sera retiré du catalogue.`,()=>{data.products=data.products.filter(x=>x.id!==id);state.cart=state.cart.filter(x=>x.id!==id);save();log('Produit',`${p.name} supprimé`);renderAll();toast('Produit supprimé');}); }
  function openStockDialog(id){ if(!hasPermission('manageStock')){toast('Accès refusé');return;} const p=data.products.find(x=>x.id===id); if(!p)return; state.stockTarget=id;state.stockMode='add';$('#stockProductSummary').innerHTML=`<span class="emoji">${p.icon||'📦'}</span><span><b>${escapeHtml(p.name)}</b><small>Stock actuel : ${p.stock}</small></span>`;$('#stockQuantity').value='1';$$('[data-stock-mode]').forEach(b=>b.classList.toggle('active',b.dataset.stockMode==='add'));openDialog('stockDialog'); }
  function saveStock(e){ e.preventDefault(); const p=data.products.find(x=>x.id===state.stockTarget); if(!p)return; const before=p.stock,q=Math.max(0,Math.floor(Number($('#stockQuantity').value)||0)); if(state.stockMode==='add')p.stock+=q;else if(state.stockMode==='remove')p.stock=Math.max(0,p.stock-q);else p.stock=q;save();log('Stock',`${p.name} : ${before} → ${p.stock}`);closeDialog('stockDialog');renderAll();toast('Stock mis à jour'); }


  function renderCategoryManager(){
    const host=$('#categoryManagerList'); if(!host)return; normalizeData(data);
    host.innerHTML=data.productCategories.map((c,index)=>`<div class="category-manager-row">
      <input type="text" value="${escapeHtml(c)}" maxlength="40" data-category-name="${index}" aria-label="Nom de la catégorie ${escapeHtml(c)}" />
      <div class="order-buttons">
        <button type="button" class="table-action" data-category-up="${index}" ${index===0?'disabled':''} title="Monter">↑</button>
        <button type="button" class="table-action" data-category-down="${index}" ${index===data.productCategories.length-1?'disabled':''} title="Descendre">↓</button>
      </div>
    </div>`).join('');
    $$('[data-category-name]').forEach(input=>input.onchange=()=>renameCategory(Number(input.dataset.categoryName),input.value));
    $$('[data-category-up]').forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.categoryUp),-1));
    $$('[data-category-down]').forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.categoryDown),1));
  }
  function renameCategory(index,newName){
    if(!can(3)){toast('Accès refusé');renderCategoryManager();return;}
    normalizeData(data); const oldName=data.productCategories[index]; newName=String(newName||'').trim();
    if(!oldName||!newName){toast('Le nom de catégorie ne peut pas être vide');renderCategoryManager();return;}
    if(data.productCategories.some((c,i)=>i!==index&&c.toLowerCase()===newName.toLowerCase())){toast('Cette catégorie existe déjà');renderCategoryManager();return;}
    data.productCategories[index]=newName; data.products.forEach(p=>{if(p.category===oldName)p.category=newName;});
    if(state.category===oldName)state.category=newName;
    save();log('Catégories',`${oldName} renommée en ${newName}`);renderAll();toast('Catégorie renommée');
  }
  function moveCategory(index,delta){
    if(!can(3)){toast('Accès refusé');return;} normalizeData(data); const target=index+delta;
    if(index<0||target<0||index>=data.productCategories.length||target>=data.productCategories.length)return;
    [data.productCategories[index],data.productCategories[target]]=[data.productCategories[target],data.productCategories[index]];
    save();log('Catégories',`Ordre modifié : ${data.productCategories.join(' > ')}`);renderAll();toast('Ordre des catégories enregistré');
  }

  function moveMaterial(id,delta){
    if(!hasPermission('manageSupplies')){toast('Accès refusé');return;} const index=data.materials.findIndex(m=>m.id===id); const target=index+delta;
    if(index<0||target<0||target>=data.materials.length)return;
    [data.materials[index],data.materials[target]]=[data.materials[target],data.materials[index]];
    save();log('Matières premières',`Ordre modifié : ${data.materials[index].name} / ${data.materials[target].name}`);renderSupplies();toast('Ordre des matières enregistré');
  }
  function sortMaterialsAlphabetically(){
    if(!can(2)){toast('Accès refusé');return;}
    data.materials.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base'}));
    save();log('Matières premières','Catalogue classé par ordre alphabétique');renderSupplies();toast('Matières classées de A à Z');
  }


  function totalSupplySpent(){ return data.supplyOrders.reduce((s,o)=>s+Number(o.totalPesos||0),0); }
  function supplyDraftTotal(){ return state.supplyDraft.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.pricePesos)||0),0); }
  function renderSupplies(){
    if(!$('#supplyMetrics'))return;
    $('#supplyMetrics').innerHTML=[
      metric('₱','Solde disponible',peso(data.cashDrawerPesos),'fonds global','teal'),
      metric('◈','Matières',data.materials.length,'références fournisseurs'),
      metric('🛒','Commandes',data.supplyOrders.length,'commandes passées'),
      metric('−','Total dépensé',peso(totalSupplySpent()),'achats de matières','warn')
    ].join('');

    const q=state.materialSearch.toLowerCase().trim();
    const materials=data.materials.filter(m=>`${m.name} ${m.supplier} ${m.unit}`.toLowerCase().includes(q));
    $('#materialsTable').innerHTML=materials.length?materials.map(m=>{const realIndex=data.materials.findIndex(x=>x.id===m.id);return `<tr>
      <td><div class="product-cell"><span class="cell-icon">◈</span><b>${escapeHtml(m.name)}</b></div></td>
      <td>${escapeHtml(m.supplier||'—')}</td>
      <td>${escapeHtml(m.unit)}</td>
      <td><b>${peso(m.pricePesos)}</b></td>
      <td class="right">${hasPermission('manageSupplies')?`<div class="table-actions">
        <button type="button" class="table-action order-arrow" data-material-up="${m.id}" ${realIndex===0?'disabled':''} title="Monter">↑</button>
        <button type="button" class="table-action order-arrow" data-material-down="${m.id}" ${realIndex===data.materials.length-1?'disabled':''} title="Descendre">↓</button>
        <button type="button" class="table-action stock" data-add-material-order="${m.id}">＋ Commander</button>
        <button type="button" class="table-action edit" data-edit-material="${m.id}">Modifier</button>
        <button type="button" class="table-action danger" data-delete-material="${m.id}">Supprimer</button>
      </div>`:'<span class="muted">Lecture seule</span>'}</td>
    </tr>`}).join(''):'<tr><td colspan="5" class="empty-table">Aucune matière enregistrée.</td></tr>';

    $$('[data-material-up]').forEach(b=>b.onclick=()=>moveMaterial(Number(b.dataset.materialUp),-1));
    $$('[data-material-down]').forEach(b=>b.onclick=()=>moveMaterial(Number(b.dataset.materialDown),1));
    $$('[data-add-material-order]').forEach(b=>b.onclick=()=>addMaterialToDraft(Number(b.dataset.addMaterialOrder)));
    $$('[data-edit-material]').forEach(b=>b.onclick=()=>openMaterialDialog(Number(b.dataset.editMaterial)));
    $$('[data-delete-material]').forEach(b=>b.onclick=()=>deleteMaterial(Number(b.dataset.deleteMaterial)));

    renderSupplyDraft();
    $('#supplyOrdersTable').innerHTML=data.supplyOrders.length?data.supplyOrders.map(o=>`<tr>
      <td>${formatDate(o.date)}</td>
      <td><b>${escapeHtml(o.id)}</b></td>
      <td>${escapeHtml(o.employee)}</td>
      <td>${o.items.reduce((s,i)=>s+Number(i.qty||0),0)}</td>
      <td><b>${peso(o.totalPesos)}</b></td>
      <td>${peso(o.balanceAfter)}</td>
      <td>${escapeHtml(o.note||'—')}</td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty-table">Aucune commande de matières premières.</td></tr>';
  }

  function renderSupplyDraft(){
    const host=$('#supplyDraftList'); if(!host)return;
    host.innerHTML=state.supplyDraft.length?state.supplyDraft.map(i=>`<div class="supply-draft-item">
      <div class="supply-draft-main">
        <b>${escapeHtml(i.name)}</b>
        <small>${escapeHtml(i.supplier||'Sans fournisseur')} • ${peso(i.pricePesos)} / ${escapeHtml(i.unit)}</small>
      </div>
      <div class="supply-qty">
        <button type="button" data-supply-id="${i.id}" data-supply-delta="-1">−</button>
        <b>${i.qty}</b>
        <button type="button" data-supply-id="${i.id}" data-supply-delta="1">+</button>
      </div>
      <strong>${peso(i.qty*i.pricePesos)}</strong>
      <button type="button" class="supply-remove" data-remove-supply="${i.id}" aria-label="Retirer">×</button>
    </div>`).join(''):'<div class="empty-cart supply-empty"><div><span class="big">🛒</span><b>Aucune matière</b><br>Ajoute des matières depuis le catalogue.</div></div>';

    $$('[data-supply-id]').forEach(b=>b.onclick=()=>changeSupplyQty(Number(b.dataset.supplyId),Number(b.dataset.supplyDelta)));
    $$('[data-remove-supply]').forEach(b=>b.onclick=()=>{state.supplyDraft=state.supplyDraft.filter(i=>i.id!==Number(b.dataset.removeSupply));renderSupplyDraft();});
    const total=supplyDraftTotal();
    $('#supplyDraftTotal').textContent=peso(total);
    $('#supplyBalanceAfter').textContent=`Solde après commande : ${peso(Math.max(0,Number(data.cashDrawerPesos)-total))}`;
    $('#supplyBalanceAfter').classList.toggle('insufficient',total>Number(data.cashDrawerPesos));
    $('#submitSupplyOrder').disabled=!state.supplyDraft.length||total<=0;
  }

  function addMaterialToDraft(id){ if(!hasPermission('manageSupplies')){toast('Accès refusé');return;}
    const m=data.materials.find(x=>x.id===id); if(!m)return;
    const item=state.supplyDraft.find(x=>x.id===id);
    if(item)item.qty++; else state.supplyDraft.push({...m,qty:1});
    renderSupplyDraft(); toast(`${m.name} ajouté à la commande`);
  }
  function changeSupplyQty(id,delta){
    const item=state.supplyDraft.find(x=>x.id===id);if(!item)return;
    item.qty=Math.max(0,item.qty+delta);
    if(item.qty===0)state.supplyDraft=state.supplyDraft.filter(x=>x.id!==id);
    renderSupplyDraft();
  }
  function openMaterialDialog(id=null){
    if(!hasPermission('manageSupplies')){toast('Accès refusé');return;}
    const m=id?data.materials.find(x=>x.id===id):null;
    $('#materialDialogTitle').textContent=m?'Modifier la matière':'Ajouter une matière';
    $('#materialId').value=m?.id||'';
    $('#materialName').value=m?.name||'';
    $('#materialSupplier').value=m?.supplier||'';
    $('#materialUnit').value=m?.unit||'unité';
    $('#materialPrice').value=m?.pricePesos??'';
    openDialog('materialDialog');
    setTimeout(()=>$('#materialName').focus(),50);
  }
  function saveMaterial(e){
    e.preventDefault(); if(!hasPermission('manageSupplies')){toast('Accès refusé');return;}
    const id=Number($('#materialId').value)||null;
    const material={name:$('#materialName').value.trim(),supplier:$('#materialSupplier').value.trim(),unit:$('#materialUnit').value,pricePesos:Math.max(0,Number($('#materialPrice').value)||0)};
    if(!material.name||material.pricePesos<=0){toast('Indique un nom et un prix valide');return;}
    if(id){
      const target=data.materials.find(x=>x.id===id); if(!target)return;
      Object.assign(target,material);
      const draft=state.supplyDraft.find(x=>x.id===id); if(draft)Object.assign(draft,material);
      log('Matière première',`${material.name} modifiée • ${peso(material.pricePesos)} / ${material.unit}`);
    } else {
      material.id=Date.now(); data.materials.push(material);
      log('Matière première',`${material.name} ajoutée • ${peso(material.pricePesos)} / ${material.unit}`);
    }
    save();closeDialog('materialDialog');renderSupplies();toast(id?'Matière modifiée':'Matière ajoutée');
  }
  function deleteMaterial(id){ if(!hasPermission('manageSupplies')){toast('Accès refusé');return;}
    const m=data.materials.find(x=>x.id===id);if(!m)return;
    confirmAction('Supprimer cette matière ?',`${m.name} sera retirée du catalogue fournisseur. Les anciennes commandes resteront dans l’historique.`,()=>{
      data.materials=data.materials.filter(x=>x.id!==id);
      state.supplyDraft=state.supplyDraft.filter(x=>x.id!==id);
      save();log('Matière première',`${m.name} supprimée`);renderSupplies();toast('Matière supprimée');
    });
  }
  function submitSupplyOrder(){
    if(!state.supplyDraft.length)return;
    const total=supplyDraftTotal(),balance=Number(data.cashDrawerPesos||0);
    if(total>balance){toast(`Solde insuffisant : il manque ${peso(total-balance)}`);return;}
    const qty=state.supplyDraft.reduce((s,i)=>s+i.qty,0);
    confirmAction('Commander et payer ?',`Cette commande contient ${qty} unité(s) pour un total de ${peso(total)}. La somme sera immédiatement déduite du solde global.`,()=>{
      const before=Number(data.cashDrawerPesos||0),after=before-total;
      const order={id:'MAT-'+String(Date.now()).slice(-6),date:nowISO(),employee:state.currentUser.name,employeeId:state.currentUser.id,note:$('#supplyOrderNote').value.trim(),totalPesos:total,balanceBefore:before,balanceAfter:after,items:state.supplyDraft.map(i=>({...i}))};
      data.cashDrawerPesos=after;
      data.supplyOrders.unshift(order);
      recordDrawerMovement('purchase',total,before,after,`Commande matières ${order.id}`,'MXN',total);
      save();log('Commande matières',`${order.id} • ${peso(total)} • ${qty} unité(s)`);
      state.supplyDraft=[];state.supplyNote='';$('#supplyOrderNote').value='';
      renderAll();toast(`Commande ${order.id} payée`);
    });
  }
  function exportSupplyOrdersCSV(){
    const rows=[['Date','Commande','Employé','Matière','Fournisseur','Quantité','Unité','Prix unité pesos','Total ligne pesos','Total commande pesos','Solde après','Note']];
    data.supplyOrders.forEach(o=>o.items.forEach(i=>rows.push([formatDate(o.date),o.id,o.employee,i.name,i.supplier||'',i.qty,i.unit,Number(i.pricePesos).toFixed(2),Number(i.qty*i.pricePesos).toFixed(2),Number(o.totalPesos).toFixed(2),Number(o.balanceAfter).toFixed(2),o.note||''])));
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
    downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'rexs-diner-commandes-matieres.csv');toast('Export des commandes créé');
  }

  function renderSales(){
    const count=data.sales.length,rev=revenue();$('#salesMetrics').innerHTML=[metric('$','Chiffre d’affaires',money(rev),'total encaissé','teal'),metric('#','Tickets',count,'commandes'),metric('Ø','Ticket moyen',money(count?rev/count:0),'par commande'),metric('+','Articles vendus',itemsSold(),'unités')].join('');
    const q=state.salesSearch.toLowerCase().trim(); const list=data.sales.filter(s=>`${s.id} ${s.employee} ${s.method}`.toLowerCase().includes(q)); $('#salesTable').innerHTML=list.length?list.map(s=>`<tr><td>${formatDate(s.date)}</td><td>${escapeHtml(s.employee)}</td><td><b>${s.id}</b></td><td>${s.items.reduce((a,i)=>a+i.qty,0)}</td><td>${escapeHtml(s.method)} • ${currencyName(s.currency||'USD')}</td><td><b>${currencyAmount(s.paidTotal ?? (s.currency==='MXN'?toPesos(s.total):s.total),s.currency||'USD')}</b><small class="table-conversion">${s.currency==='MXN'?money(s.total):peso(toPesos(s.total))}</small></td><td><button type="button" class="table-action" data-receipt="${s.id}">Ticket</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-table">Aucune vente enregistrée.</td></tr>'; $$('[data-receipt]').forEach(b=>b.onclick=()=>{const s=data.sales.find(x=>x.id===b.dataset.receipt);if(s)showReceipt(s);});
  }
  function exportSalesCSV(){ const rows=[['Date','Employé','Ticket','Articles','Paiement','Devise','Total payé','Equivalent USD'],...data.sales.map(s=>[formatDate(s.date),s.employee,s.id,s.items.reduce((a,i)=>a+i.qty,0),s.method,currencyName(s.currency||'USD'),Number(s.paidTotal ?? (s.currency==='MXN'?toPesos(s.total):s.total)).toFixed(2),Number(s.total).toFixed(2)])]; const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n'); downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'rexs-diner-ventes.csv'); toast('Export CSV créé'); }

  function renderCashOverview(){
    const host=$('#cashOverviewBalances'); if(!host)return;
    host.innerHTML=`<div class="cash-balance peso"><span class="currency-symbol">₱</span><div><span>Solde global de caisse</span><strong>${peso(data.cashDrawerPesos)}</strong><small>≈ ${money(toDollars(data.cashDrawerPesos))} • 1 $ = 23 pesos</small></div></div>`;
  }
  function recordDrawerMovement(type,amount,before,after,reason,originalCurrency='MXN',originalAmount=null){
    data.drawerMovements.unshift({id:Date.now()+Math.random(),date:nowISO(),employee:state.currentUser?.name||'Système',currency:'MXN',type,amount:Number(amount)||0,before:Number(before)||0,after:Number(after)||0,reason:reason||'',originalCurrency,originalAmount:originalAmount==null?Number(amount)||0:Number(originalAmount)||0});
    data.drawerMovements=data.drawerMovements.slice(0,500);
  }



  function getDrawerCurrency(){
    return $('#drawerCurrency')?.value || 'MXN';
  }

  function drawerInputToPesos(){
    const amount=Math.max(0,Number($('#drawerAmount')?.value)||0);
    return getDrawerCurrency()==='USD' ? amount*EXCHANGE_RATE : amount;
  }

  function updateDrawerCurrencyPreview(){
    const amount=Math.max(0,Number($('#drawerAmount')?.value)||0);
    const currency=getDrawerCurrency();
    const pesosValue=currency==='USD'?amount*EXCHANGE_RATE:amount;
    const box=$('#drawerCurrencyPreview');
    if(!box)return;
    const strong=box.querySelector('strong');
    const span=box.querySelector('span');
    if(strong)strong.textContent=peso(pesosValue);
    if(span)span.textContent=currency==='USD'
      ? `Conversion : ${amount.toFixed(2)} $ × ${EXCHANGE_RATE}`
      : 'Impact sur le solde global';
  }

  function renderDrawer(){
    if(!$('#drawerMetrics'))return;
    const usdEquivalent=toDollars(data.cashDrawerPesos);
    $('#drawerMetrics').innerHTML=[metric('₱','Solde global',peso(data.cashDrawerPesos),'fonds physique total','teal'),metric('$','Équivalent',money(usdEquivalent),'conversion informative'),metric('×','Taux de change','1 $ = 23 pesos','taux fixe du serveur'),metric('≡','Mouvements',data.drawerMovements.length,'opérations enregistrées')].join('');
    $('#drawerCombinedValue').textContent=peso(data.cashDrawerPesos);
    const last=data.drawerMovements.slice(0,5);
    $('#drawerHistory').innerHTML=last.length?last.map(m=>`<div class="compact-row"><div><b>${escapeHtml(m.reason||movementLabel(m.type))}</b><small>${escapeHtml(m.employee)} • ${formatDate(m.date)}</small></div><strong class="${movementClass(m.type)}">${movementPrefix(m.type)}${peso(m.amount)}</strong></div>`).join(''):'<div class="empty-mini">Aucun mouvement du fonds de caisse.</div>';
    $('#drawerTable').innerHTML=data.drawerMovements.length?data.drawerMovements.map(m=>`<tr><td>${formatDate(m.date)}</td><td>${escapeHtml(m.employee)}</td><td>${movementLabel(m.type)}</td><td class="${movementClass(m.type)}">${movementPrefix(m.type)}${peso(m.amount)}</td><td>${peso(m.before)}</td><td><b>${peso(m.after)}</b></td><td>${escapeHtml(m.reason||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-table">Aucun mouvement enregistré.</td></tr>';
    renderCashOverview();
  }
  function movementLabel(type){return type==='add'?'Ajout':type==='add_dollars'?'Ajout dollars':type==='remove'?'Retrait':type==='set'?'Correction':type==='purchase'?'Achat matières':'Vente espèces';}
  function movementClass(type){return (type==='remove'||type==='purchase')?'cash-movement-negative':type==='set'?'cash-movement-set':'cash-movement-positive';}
  function movementPrefix(type){return (type==='remove'||type==='purchase')?'− ':type==='set'?'= ':'+ ';}
  function openDrawerDialog(){
    if($('#drawerCurrency'))$('#drawerCurrency').value='MXN';
    setTimeout(updateDrawerCurrencyPreview,0); if(!hasPermission('adjustDrawer')){toast('Accès refusé');return;} state.drawerMode='add'; $('#drawerAmount').value='0'; $('#drawerReason').value=''; $$('[data-drawer-mode]').forEach(b=>b.classList.toggle('active',b.dataset.drawerMode==='add')); renderDrawerDialogSummary(); openDialog('drawerDialog'); }
  function renderDrawerDialogSummary(){ $('#drawerCurrentSummary').innerHTML=`<div class="cash-summary-line"><span>Solde global</span><strong>${peso(data.cashDrawerPesos)}</strong></div><div class="cash-summary-line"><span>Équivalent informatif</span><strong>${money(toDollars(data.cashDrawerPesos))}</strong></div><div class="cash-summary-line"><span>Taux appliqué</span><strong>1 $ = 23 pesos</strong></div>`; }
  function saveDrawerAdjustment(e){
    e.preventDefault(); if(!hasPermission('adjustDrawer')){toast('Accès refusé');return;}
    const originalAmount=Math.max(0,Number($('#drawerAmount').value)||0);
    const currency=getDrawerCurrency();
    const amount=currency==='USD'?originalAmount*EXCHANGE_RATE:originalAmount; const reason=$('#drawerReason').value.trim()||'Ajustement manuel'; const before=Number(data.cashDrawerPesos||0); let after=before;
    if(state.drawerMode==='add')after=before+amount; else if(state.drawerMode==='remove')after=Math.max(0,before-amount); else after=amount;
    const effectiveAmount=Math.abs(after-before); data.cashDrawerPesos=after; recordDrawerMovement(state.drawerMode,effectiveAmount,before,after,reason,'MXN',effectiveAmount,currency,originalAmount); save(); log('Fonds de caisse',`${peso(before)} → ${peso(after)} • ${reason}`); closeDialog('drawerDialog'); renderAll(); toast('Fonds de caisse mis à jour');
  }

  const permissionDefinitions=[
    ['dashboard','Accueil'],['pos','Caisse'],['stock','Stocks'],['supplies','Matières'],['sales','Ventes'],['drawer','Voir le fonds de caisse'],['journal','Journal'],['settings','Réglages'],['adjustDrawer','Ajouter / retirer des fonds manuellement'],['manageStock','Modifier les produits et les stocks'],['manageSupplies','Gérer les matières et commandes'],['clearSales','Effacer les ventes'],['clearJournal','Vider le journal']
  ];
  function renderRolePermissions(){
    const host=$('#rolePermissionsManager'); if(!host)return;
    host.innerHTML=['Employé','Manager','Patron'].map(role=>`<div class="permission-role-card"><div class="permission-role-head"><b>${escapeHtml(role)}</b><small>${role==='Patron'?'Accès complet permanent':'Autorisations personnalisables'}</small></div><div class="permission-grid">${permissionDefinitions.map(([key,label])=>`<label class="permission-item"><input type="checkbox" data-role-permission="${escapeHtml(role)}" data-permission-key="${key}" ${data.rolePermissions[role][key]?'checked':''} ${role==='Patron'?'disabled':''}><span>${escapeHtml(label)}</span></label>`).join('')}</div></div>`).join('');
    $$('[data-role-permission]').forEach(input=>input.onchange=()=>{if(!can(3))return;const role=input.dataset.rolePermission;const key=input.dataset.permissionKey;data.rolePermissions[role][key]=input.checked;save();log('Permissions',`${role} • ${key} : ${input.checked?'autorisé':'refusé'}`);renderRolePermissions();toast('Permissions mises à jour');});
  }

  function renderEmployees(){ $('#employeeTable').innerHTML=data.employees.map(e=>`<tr><td><div class="employee-cell"><span class="cell-icon">${escapeHtml(e.initials)}</span><b>${escapeHtml(e.name)}</b></div></td><td><span class="status ${e.role==='Patron'?'patron':e.role==='Manager'?'manager':'ok'}">${escapeHtml(e.role)}</span></td><td><span class="status ${e.inService?'ok':'out'}">${e.inService?'En service':'Hors service'}</span>${e.inService?`<small class="service-countdown-small" data-service-countdown="${e.id}">${serviceCountdown(e)}</small>`:''}</td><td>${peso(e.salaryPesos)} / ${Number(e.payrollIntervalMinutes)} min</td><td><span class="status ${e.active?'ok':'out'}">${e.active?'Actif':'Désactivé'}</span></td><td>${formatDate(e.lastLogin)}</td><td class="right"><div class="table-actions"><button type="button" class="table-action edit" data-edit-employee="${e.id}">Modifier</button>${e.id!==state.currentUser?.id?`<button type="button" class="table-action danger" data-delete-employee="${e.id}">Supprimer</button>`:''}</div></td></tr>`).join(''); $$('[data-edit-employee]').forEach(b=>b.onclick=()=>openEmployeeDialog(Number(b.dataset.editEmployee))); $$('[data-delete-employee]').forEach(b=>b.onclick=()=>deleteEmployee(Number(b.dataset.deleteEmployee))); }
  function openEmployeeDialog(id=null){ if(!can(3)){toast('Accès refusé');return;} const e=id?data.employees.find(x=>x.id===id):null;$('#employeeDialogTitle').textContent=e?'Modifier l’employé':'Ajouter un employé';$('#employeeId').value=e?.id||'';$('#employeeName').value=e?.name||'';$('#employeeInitials').value=e?.initials||'';$('#employeeRole').value=e?.role||'Employé';$('#employeePin').value=e?.pin||'';$('#employeeSalary').value=e?.salaryPesos??0;$('#employeePayrollInterval').value=e?.payrollIntervalMinutes??60;$('#employeeActive').checked=e?.active??true;openDialog('employeeDialog'); }
  function saveEmployee(e){ e.preventDefault(); const id=Number($('#employeeId').value)||null; const pin=$('#employeePin').value.trim();if(!/^\d{4}$/.test(pin)){toast('Le PIN doit contenir 4 chiffres');return;}const emp={name:$('#employeeName').value.trim(),initials:$('#employeeInitials').value.trim().toUpperCase(),role:$('#employeeRole').value,pin,active:$('#employeeActive').checked,salaryPesos:Math.max(0,Number($('#employeeSalary').value)||0),payrollIntervalMinutes:Math.max(1,Number($('#employeePayrollInterval').value)||60)};if(!emp.name||!emp.initials){toast('Complète les informations');return;}if(id){const target=data.employees.find(x=>x.id===id);const intervalChanged=Number(target.payrollIntervalMinutes)!==emp.payrollIntervalMinutes;Object.assign(target,emp);if(target.inService&&intervalChanged)target.nextPayrollAt=new Date(Date.now()+emp.payrollIntervalMinutes*60000).toISOString();if(state.currentUser.id===id)state.currentUser=target;log('Employé',`${emp.name} modifié (${emp.role})`);}else{emp.id=Date.now();emp.lastLogin=null;emp.inService=false;emp.serviceStartedAt=null;emp.nextPayrollAt=null;data.employees.push(emp);log('Employé',`${emp.name} ajouté (${emp.role})`);}save();closeDialog('employeeDialog');applyPermissions();renderAll();renderLogin();toast(id?'Employé modifié':'Employé ajouté'); }
  function deleteEmployee(id){const e=data.employees.find(x=>x.id===id);if(!e)return;confirmAction('Supprimer cet employé ?',`${e.name} ne pourra plus se connecter.`,()=>{data.employees=data.employees.filter(x=>x.id!==id);save();log('Employé',`${e.name} supprimé`);renderEmployees();renderLogin();toast('Employé supprimé');});}

  function renderJournal(){ const q=state.journalSearch.toLowerCase().trim();const list=data.journal.filter(j=>`${j.employee} ${j.action} ${j.detail}`.toLowerCase().includes(q));$('#journalTable').innerHTML=list.length?list.map(j=>`<tr><td>${formatDate(j.date)}</td><td>${escapeHtml(j.employee)}</td><td><b>${escapeHtml(j.action)}</b></td><td>${escapeHtml(j.detail)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-table">Aucune activité enregistrée.</td></tr>'; }

  function exportData(){ const payload={version:11.12,exportedAt:nowISO(),data}; downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`rexs-diner-sauvegarde-${new Date().toISOString().slice(0,10)}.json`);toast('Sauvegarde téléchargée'); }
  function importData(file){ const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);const source=parsed.data||parsed;if(!Array.isArray(source.products)||!Array.isArray(source.employees))throw new Error();confirmAction('Importer cette sauvegarde ?','Les données actuelles seront remplacées.',()=>{Object.assign(data,fresh(),source);normalizeData(data);save();log('Sauvegarde','Données importées');renderAll();renderLogin();toast('Sauvegarde importée');});}catch{toast('Fichier de sauvegarde invalide');}};reader.readAsText(file); }
  function downloadBlob(blob,name){ const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }

  function openDialog(id){ const d=$('#'+id);$('#modalBackdrop').classList.remove('hidden');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open',''); }
  function closeDialog(id){ const d=$('#'+id);if(d.open&&typeof d.close==='function')d.close();else d.removeAttribute('open'); if(!$$('dialog[open]').length)$('#modalBackdrop').classList.add('hidden'); }
  function confirmAction(title,text,fn){ state.confirmAction=fn;$('#confirmTitle').textContent=title;$('#confirmText').textContent=text;openDialog('confirmDialog'); }

  function renderAll(){ normalizeData(data);renderDashboard();renderPOS();renderStock();renderSupplies();renderSales();renderDrawer();renderEmployees();renderJournal();renderRolePermissions();renderCategoryManager();renderDiscountManager();renderMyService();$('#lowStockThreshold').value=data.lowStockThreshold;$('#taxRate').value=data.taxRate; }

  // Login bindings
  $$('#pinPad [data-pin]').forEach(b=>b.addEventListener('click',()=>pressPin(b.dataset.pin)));
  $('#pinClear').onclick=()=>{state.pin='';renderPin();}; $('#pinBack').onclick=()=>{state.pin=state.pin.slice(0,-1);renderPin();};
  document.addEventListener('keydown',e=>{ if(!$('#loginView').classList.contains('hidden')){ if(/^\d$/.test(e.key))pressPin(e.key); else if(e.key==='Backspace'){$('#pinBack').click();} else if(e.key==='Escape'){$('#pinClear').click();} } });

  // Navigation & menus
  $$('#nav [data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view)); $$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go)); $('#heroOpenPos').onclick=()=>switchView('pos'); $('#quickNewSale').onclick=()=>switchView('pos');
  $('#userMenuButton').onclick=()=>{const menu=$('#userMenu');menu.classList.toggle('hidden');$('#userMenuButton').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')));}; $('#lockButton').onclick=lockApp;$('#logoutButton').onclick=logout;
  document.addEventListener('click',e=>{ if(!e.target.closest('.topbar-actions'))$('#userMenu').classList.add('hidden'); });

  // POS
  $('#productSearch').oninput=e=>{state.productSearch=e.target.value;renderProducts();};$('#clearCart').onclick=()=>{if(!state.cart.length)return;confirmAction('Vider le ticket ?','Tous les articles de la commande en cours seront retirés.',()=>{state.cart=[];renderCart();log('Ticket','Ticket en cours vidé');});};$('#discountSelect').onchange=e=>{state.discount=Number(e.target.value);renderCart();};$('#orderNote').oninput=e=>state.orderNote=e.target.value;$('#holdSale').onclick=holdSale;$$('[data-currency]').forEach(b=>b.onclick=()=>{state.paymentCurrency=b.dataset.currency;$$('[data-currency]').forEach(x=>x.classList.toggle('active',x===b));renderCart();});$$('.payment').forEach(b=>b.onclick=()=>openOrderConfirmation(b.dataset.method));

  // Stock/products
  $('#addProduct').onclick=()=>{if(requirePermission('manageStock'))openProductDialog();};$('#productForm').addEventListener('submit',saveProduct);$('#stockSearch').oninput=e=>{state.stockSearch=e.target.value;renderStock();};$('#stockFilter').onchange=e=>{state.stockFilter=e.target.value;renderStock();};$$('[data-stock-mode]').forEach(b=>b.onclick=()=>{state.stockMode=b.dataset.stockMode;$$('[data-stock-mode]').forEach(x=>x.classList.toggle('active',x===b));});$$('[data-quick]').forEach(b=>b.onclick=()=>$('#stockQuantity').value=b.dataset.quick);$('#stockForm').addEventListener('submit',e=>{if(!requirePermission('manageStock')){e.preventDefault();return;}saveStock(e);});



  if($('#drawerCurrency')) $('#drawerCurrency').onchange=updateDrawerCurrencyPreview;
  if($('#drawerAmount')) $('#drawerAmount').oninput=updateDrawerCurrencyPreview;

  // Matières premières / commandes fournisseurs
  $('#addMaterial').onclick=()=>{if(requirePermission('manageSupplies'))openMaterialDialog();};
  $('#materialForm').addEventListener('submit',e=>{if(!requirePermission('manageSupplies')){e.preventDefault();return;}saveMaterial(e);});
  $('#materialSearch').oninput=e=>{state.materialSearch=e.target.value;renderSupplies();};
  if($('#sortMaterialsAZ')) $('#sortMaterialsAZ').onclick=sortMaterialsAlphabetically;
  $('#openSupplyOrder').onclick=()=>{switchView('supplies');setTimeout(()=>$('#supplyDraftList').scrollIntoView({behavior:'smooth',block:'center'}),80);};
  $('#clearSupplyDraft').onclick=()=>{if(!state.supplyDraft.length)return;confirmAction('Vider la commande en préparation ?','Les matières sélectionnées seront retirées du panier fournisseur.',()=>{state.supplyDraft=[];renderSupplyDraft();toast('Commande en préparation vidée');});};
  $('#supplyOrderNote').oninput=e=>state.supplyNote=e.target.value;
  $('#submitSupplyOrder').onclick=()=>{if(requirePermission('manageSupplies'))submitSupplyOrder();};
  $('#exportSupplyOrders').onclick=exportSupplyOrdersCSV;
if($('#cashPayBtn')) $('#cashPayBtn').onclick=()=>openOrderConfirmation('Espèces');

  if($('#orderConfirmForm')) $('#orderConfirmForm').addEventListener('submit',confirmAndCheckout);

  // Sales
  $('#salesSearch').oninput=e=>{state.salesSearch=e.target.value;renderSales();};$('#exportSales').onclick=exportSalesCSV;$('#clearSales').onclick=()=>{if(!requirePermission('clearSales'))return;confirmAction('Effacer l’historique des ventes ?','Cette action supprimera toutes les ventes enregistrées.',()=>{data.sales=[];save();log('Ventes','Historique des ventes effacé');renderAll();toast('Historique effacé');});};

  // Cash drawer
  $('#adjustDrawer').onclick=()=>{if(requirePermission('adjustDrawer'))openDrawerDialog();}; $('#drawerForm').addEventListener('submit',e=>{if(!requirePermission('adjustDrawer')){e.preventDefault();return;}saveDrawerAdjustment(e);}); $$('[data-drawer-mode]').forEach(b=>b.onclick=()=>{state.drawerMode=b.dataset.drawerMode;$$('[data-drawer-mode]').forEach(x=>x.classList.toggle('active',x===b));});

  // Employees/journal
  $('#addEmployee').onclick=()=>openEmployeeDialog();$('#employeeForm').addEventListener('submit',saveEmployee);setInterval(refreshServiceCountdowns,1000);$('#journalSearch').oninput=e=>{state.journalSearch=e.target.value;renderJournal();};$('#clearJournal').onclick=()=>{if(!requirePermission('clearJournal'))return;confirmAction('Vider le journal ?','Toutes les traces d’activité seront supprimées.',()=>{data.journal=[];save();renderJournal();toast('Journal vidé');});};

  // Settings/data
  if($('#addDiscount')) $('#addDiscount').onclick=addDiscount;
  $('#saveSettings').onclick=()=>{data.lowStockThreshold=Math.max(1,Math.floor(Number($('#lowStockThreshold').value)||5));data.taxRate=Math.max(0,Number($('#taxRate').value)||0);save();log('Réglages',`Seuil stock ${data.lowStockThreshold} • TVA ${data.taxRate}%`);renderAll();toast('Réglages enregistrés');};$('#exportData').onclick=exportData;$('#importDataButton').onclick=()=>$('#importDataInput').click();$('#importDataInput').onchange=e=>{const f=e.target.files?.[0];if(f)importData(f);e.target.value='';};$('#resetApp').onclick=()=>confirmAction('Réinitialiser l’application ?','Produits, stocks, ventes, employés et journal seront remis à zéro.',()=>{const reset=fresh();Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,reset);save();state.currentUser=null;toast('Application réinitialisée');setTimeout(lockApp,350);});

  // Dialogs
  $$('[data-close-dialog]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.closeDialog));$('#confirmButton').onclick=()=>{const fn=state.confirmAction;state.confirmAction=null;closeDialog('confirmDialog');if(fn)fn();};
  $$('dialog').forEach(d=>d.addEventListener('close',()=>{if(!$$('dialog[open]').length)$('#modalBackdrop').classList.add('hidden');}));

  // Clock
  function tick(){ $('#clock').textContent=new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}); } tick();setInterval(tick,1000);

  const darkThemeToggle=$('#darkThemeToggle');
  if(darkThemeToggle) darkThemeToggle.onchange=e=>toggleTheme(e.target.checked);

  applyTheme(getStoredTheme());renderLogin();renderPin();initRealtime();startBuildWatcher();
})();
