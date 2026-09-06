// Cogheim site Worker — adds /backstage to the existing static site.
//
// Everything that is not /backstage is handed straight to the static assets in
// ./site, so the public site behaves exactly as it did before.
//
//   /backstage                                      the private console
//   /backstage/data/cogheim_production_status.json  from D1
//   /backstage/data/master_index.md                 from D1
//   /backstage/health                               what D1 holds, and when
//
// The nightly sweep writes D1. This Worker is not redeployed when data changes.
// Authentication is Cloudflare Access on cogheim.com/backstage*. This Worker
// performs no auth of its own and must never be described as if it does.

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<title>Cogheim Master Plan</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --iron-950:#0b0d10; --iron-900:#101319; --iron-850:#151920; --iron-800:#1b2129;
  --iron-700:#232b34; --iron-600:#303a45; --iron-500:#44515e;
  --brass:#c9a24b; --brass-deep:#8b6f30; --copper:#b4703a; --verdigris:#54988a;
  --parch:#eae1cd; --muted:#96a1ac; --alarm:#c4574a;
  --s-not:#414a54; --s-spec:#657588; --s-lock:#8b6f30; --s-prog:#b4703a;
  --s-built:#c9a24b; --s-comp:#82ab7e; --s-load:#54988a; --s-ver:#63b781;
  --display:"Oswald","Arial Narrow",sans-serif;
  --body:"IBM Plex Sans",-apple-system,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
  --rule:1px solid var(--iron-700);
}
*{box-sizing:border-box}
body{
  background:
    radial-gradient(1100px 520px at 15% -12%, #1a2028 0%, transparent 62%),
    linear-gradient(180deg,#0b0d10,#090b0e);
  color:var(--parch); font-family:var(--body); font-size:15px; line-height:1.55;
  margin:0; min-height:100vh;
}
.wrap{max-width:1160px;margin:0 auto;padding:0 20px 72px}

/* masthead */
header{border-bottom:var(--rule);background:linear-gradient(180deg,#141920,#0e1116);
  position:sticky;top:0;z-index:20}
.mhead{max-width:1160px;margin:0 auto;padding:15px 20px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.cog{width:32px;height:32px;flex:0 0 32px}
.mtitle{font-family:var(--display);font-weight:500;font-size:21px;letter-spacing:.13em;
  text-transform:uppercase;margin:0;line-height:1.1}
.mmeta{font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:2px;
  font-variant-numeric:tabular-nums}
.grow{flex:1}
.src{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  padding:4px 9px;border-radius:2px;border:1px solid var(--iron-600);color:var(--muted);white-space:nowrap}
.src.live{border-color:var(--verdigris);color:var(--verdigris)}
.src.local{border-color:var(--copper);color:var(--copper)}
nav{max-width:1160px;margin:0 auto;padding:11px 20px 0;display:flex;gap:2px;flex-wrap:wrap}
nav button{background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);
  font-family:var(--display);font-size:12.5px;letter-spacing:.15em;text-transform:uppercase;
  padding:8px 13px;cursor:pointer}
nav button:hover{color:var(--parch)}
nav button[aria-selected="true"]{color:var(--brass);border-bottom-color:var(--brass)}
nav button:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible,th:focus-visible
  {outline:2px solid var(--brass);outline-offset:2px}

h2{font-family:var(--display);font-size:13px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--brass);margin:36px 0 0;padding-bottom:8px;border-bottom:var(--rule);font-weight:500}
.note{font-size:12.5px;color:var(--muted);margin:10px 0 20px;border-left:2px solid var(--brass-deep);
  padding-left:12px;max-width:70ch}

/* bars */
.bars{display:flex;flex-direction:column;gap:17px;margin-top:18px}
.brow{display:grid;gap:6px}
.bhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.bname{font-family:var(--display);font-size:15px;letter-spacing:.06em}
.bsub{font-family:var(--mono);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.bpct{margin-left:auto;font-family:var(--mono);font-size:14px;color:var(--brass);
  font-variant-numeric:tabular-nums}
.gauge{height:10px;background:var(--iron-800);border-radius:1px;overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.6)}
.fill{height:100%;transition:width .9s cubic-bezier(.2,.7,.3,1)}
.f-brass{background:linear-gradient(90deg,#5f4a1c,#c9a24b)}
.f-copper{background:linear-gradient(90deg,#553419,#b4703a)}
.f-verd{background:linear-gradient(90deg,#274f48,#54988a)}
.bfoot{font-size:12px;color:var(--muted);max-width:72ch}
@media (prefers-reduced-motion:reduce){.fill{transition:none}}

/* tiles */
.tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:18px}
.tile{background:var(--iron-850);border:var(--rule);padding:12px 13px;display:grid;gap:5px}
.tile .k{font-family:var(--mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.tile .v{font-family:var(--display);font-size:27px;line-height:1;font-variant-numeric:tabular-nums}
.tile .n{font-family:var(--mono);font-size:10.5px;color:var(--muted)}

/* table */
.tw{overflow-x:auto;border:var(--rule);background:var(--iron-850);margin-top:14px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px}
th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--iron-600);background:var(--iron-800);
  cursor:pointer;white-space:nowrap;position:sticky;top:0}
td{padding:9px 12px;border-bottom:1px solid var(--iron-800);vertical-align:top}
tr:hover td{background:#181d24}
.m{font-family:var(--mono);font-size:11.5px;color:var(--muted);white-space:nowrap}
.chip{display:inline-block;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;
  text-transform:uppercase;padding:3px 7px;color:#0b0d10;white-space:nowrap;border-radius:1px}
.ev{font-size:11.5px;color:var(--muted);margin-top:3px}
.flag{font-size:11.5px;color:var(--copper);margin-top:3px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
select,input[type=search]{background:var(--iron-800);border:1px solid var(--iron-600);color:var(--parch);
  font-family:var(--mono);font-size:12px;padding:7px 9px;border-radius:2px}
input[type=search]{flex:1;min-width:170px}

/* plan body */
#plan{max-width:70ch;font-size:14.5px;line-height:1.65}
#plan h1{font-family:var(--display);font-size:21px;letter-spacing:.08em;color:var(--brass);margin:30px 0 8px;text-wrap:balance}
#plan h2{font-size:16px;border-bottom:1px solid var(--iron-800);margin:26px 0 6px;letter-spacing:.1em}
#plan h3{font-family:var(--display);font-size:14px;color:var(--copper);margin:20px 0 4px;letter-spacing:.09em}
#plan code{font-family:var(--mono);font-size:12.5px;background:var(--iron-800);padding:1px 5px}
#plan pre{background:var(--iron-850);border:var(--rule);padding:12px;overflow-x:auto;font-family:var(--mono);font-size:12.5px}
#plan blockquote{border-left:2px solid var(--brass-deep);margin:12px 0;padding-left:12px;color:var(--muted)}

.state{border:1px dashed var(--iron-500);padding:20px;color:var(--muted);font-size:13.5px;margin-top:18px;max-width:74ch}
.state strong{color:var(--parch);font-weight:600}
.state code{font-family:var(--mono);color:var(--brass);font-size:12.5px}
.state.bad{border-color:var(--alarm)}
footer{margin-top:46px;padding-top:16px;border-top:var(--rule);font-family:var(--mono);
  font-size:10.5px;color:var(--muted)}
[hidden]{display:none!important}
</style>
</head>
<body>


<header>
  <div class="mhead">
    <svg class="cog" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="19" stroke="#c9a24b" stroke-width="3"/>
      <circle cx="32" cy="32" r="6.5" stroke="#b4703a" stroke-width="3"/>
      <g stroke="#c9a24b" stroke-width="3" stroke-linecap="square">
        <path d="M32 5v8M32 51v8M5 32h8M51 32h8M13 13l5.7 5.7M45.3 45.3L51 51M51 13l-5.7 5.7M18.7 45.3L13 51"/>
      </g>
    </svg>
    <div>
      <h1 class="mtitle">Cogheim Master Plan</h1>
      <div class="mmeta" id="meta">resolving source</div>
    </div>
    <div class="grow"></div>
    <div class="src" id="srcBadge">connecting</div>
  </div>
  <nav role="tablist">
    <button role="tab" data-t="prod" aria-selected="true">Production</button>
    <button role="tab" data-t="items" aria-selected="false">Ledger</button>
    <button role="tab" data-t="plan" aria-selected="false">The Plan</button>
    <button role="tab" data-t="src" aria-selected="false">Source</button>
  </nav>
</header>

<div class="wrap">
  <section id="tab-prod">
    <div id="prodState"></div>
    <div id="prodBody" hidden>
      <h2>Gates</h2>
      <p class="note" id="honesty"></p>
      <div class="bars" id="gates"></div>
      <h2>Pillars</h2>
      <p class="note">The same item states rolled up a different way. Every item belongs to exactly one pillar. Foundation serves every pillar and is excluded from every pillar figure, because folding ops and funding into a pillar bar would inflate it.</p>
      <div class="bars" id="pillars"></div>
      <h2>Tracks</h2>
      <div class="bars" id="tracks"></div>
      <h2>States declared</h2>
      <div class="tiles" id="states"></div>
    </div>
  </section>

  <section id="tab-items" hidden>
    <h2>Item ledger</h2>
    <p class="note">Every declared item with the evidence line that justifies its state. An item may only read Verified with evidence a human could re-read.</p>
    <div class="filters">
      <select id="fG"></select><select id="fT"></select><select id="fS"></select><select id="fP"></select>
      <input type="search" id="fQ" placeholder="search name, evidence, flag">
    </div>
    <div class="tw"><table id="tbl"><thead><tr>
      <th data-s="id" tabindex="0">ID</th><th data-s="name" tabindex="0">Item</th>
      <th data-s="gate" tabindex="0">Gate</th><th data-s="track" tabindex="0">Track</th>
      <th data-s="w" tabindex="0">Wt</th><th data-s="pct" tabindex="0">State</th>
    </tr></thead><tbody></tbody></table></div>
    <p class="bfoot" id="cnt" style="margin-top:10px"></p>
  </section>

  <section id="tab-plan" hidden>
    <div id="planState"></div>
    <div id="plan"></div>
  </section>

  <section id="tab-src" hidden>
    <h2>Where the numbers come from</h2>
    <p class="note">This page stores no figures. It reads two files and renders them. Change a file, reload, the page is current. Nothing here is ever hand edited to move a bar.</p>
    <div id="srcDetail"></div>
    <h2>Reading a percentage</h2>
    <p class="note" id="honesty2"></p>
    <h2>Doctrine</h2>
    <div id="doctrine" class="bars"></div>
  </section>

  <footer id="foot"></footer>
</div>

<script>
"use strict";
var FOLDER = "11qQoQX1o1TL2t6PQvWX7rfxneT94HJiX";
var F_JSON = "cogheim_production_status.json";
var F_PLAN = "master_index.md";
var SCOLOR = {not_started:"--s-not",specced:"--s-spec",locked:"--s-lock",in_progress:"--s-prog",
  built_unverified:"--s-built",compiled:"--s-comp",loaded:"--s-load",verified:"--s-ver"};
var D=null, PLAN=null;

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function $(id){return document.getElementById(id);}

document.querySelectorAll("nav button").forEach(function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll("nav button").forEach(function(o){
      o.setAttribute("aria-selected",o===b?"true":"false");
      $("tab-"+o.dataset.t).hidden = o!==b;
    });
  });
});

/* ---------- source resolution: Drive first, local files second ---------- */
function b64utf8(b64){
  var bin=atob(b64), n=bin.length, arr=new Uint8Array(n);
  for(var i=0;i<n;i++)arr[i]=bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(arr);
}
function payloadOf(res){
  var p = res && res.payload!==undefined ? res.payload : res;
  if(typeof p==="string"){ try{ return JSON.parse(p); }catch(e){ return {raw:p}; } }
  return p||{};
}
function driveText(mcp,title){
  return mcp.callTool("Google Drive","search_files",
      {query:"parentId = '"+FOLDER+"' and title = '"+title+"'", pageSize:5, excludeContentSnippets:true})
    .then(function(r){
      var p=payloadOf(r), files=p.files||[];
      if(!files.length) return {missing:true};
      return mcp.callTool("Google Drive","download_file_content",{fileId:files[0].id})
        .then(function(r2){
          var q=payloadOf(r2);
          var c=q.content||q.base64Content||q.fileContent||q.raw||"";
          var text;
          try{ text=b64utf8(c); }catch(e){ text=String(c); }
          return {text:text, name:files[0].title, mtime:files[0].modifiedTime};
        });
    });
}
function localText(name){
  return fetch("./data/"+name,{cache:"no-store"}).then(function(r){
    if(!r.ok) throw {code:"http_"+r.status,message:"HTTP "+r.status};
    return r.text();
  }).then(function(t){return {text:t,name:name};});
}
function mcpMessage(err){
  var c=(err&&err.code)||"unknown";
  if(c==="needs_reauth") return "Google Drive needs reconnecting in your Claude connector settings. Nothing here can load until it is.";
  if(c==="server_not_connected") return "Google Drive is not connected for this viewer. Add the connector in Claude, then reload.";
  if(c==="blocked_by_policy") return "Google Drive access is blocked by policy for this viewer.";
  if(c==="approval_required") return "Google Drive access was not approved for this page.";
  if(c==="tool_error") return "Drive answered with an error: "+esc((err&&err.message)||"no detail");
  if(c==="server_unavailable") return "Drive did not answer in time. Reload to try again.";
  return "Drive call failed ("+esc(c)+").";
}

var SRC={mode:null,json:null,plan:null,err:null};

function boot(){
  var mcpP = (window.claude && claude.use) ? claude.use("mcp").catch(function(){return null;})
                                           : Promise.resolve(null);
  mcpP.then(function(mcp){
    if(mcp){
      SRC.mode="drive";
      return Promise.all([driveText(mcp,F_JSON),driveText(mcp,F_PLAN)])
        .then(apply)
        .catch(function(e){ SRC.err=mcpMessage(e); fallback(); });
    }
    return fallback();
  });
}
function fallback(){
  SRC.mode="local";
  return Promise.all([
    localText(F_JSON).catch(function(){return {missing:true};}),
    localText(F_PLAN).catch(function(){return {missing:true};})
  ]).then(apply);
}
function apply(pair){
  SRC.json=pair[0]; SRC.plan=pair[1];
  var badge=$("srcBadge");
  badge.className="src "+(SRC.mode==="drive"?"live":"local");
  badge.textContent = SRC.mode==="drive" ? "Google Drive, live" : "local files";
  renderSource();
  if(SRC.json && SRC.json.text){
    try{ D=JSON.parse(SRC.json.text); }
    catch(e){ return prodMissing("<strong>The status file did not parse as JSON.</strong> "+esc(e.message)); }
    renderProduction();
  } else {
    prodMissing("<strong>No production data yet.</strong> This page is looking for <code>"+F_JSON+
      "</code>"+(SRC.mode==="drive"?" in the Cogheim Drive folder":" at <code>./data/</code>")+
      " and it is not there."+(SRC.err?" "+SRC.err:"")+
      "<br><br>Export the current status file to that name and reload. Nothing else is needed.");
  }
  renderPlan();
  $("foot").textContent = "Cogheim internal  ·  rendered from declared item states  ·  read "+
    new Date().toISOString().slice(0,16).replace("T"," ")+" UTC";
}
function prodMissing(html){
  $("prodState").innerHTML='<div class="state'+(SRC.err?" bad":"")+'">'+html+'</div>';
  $("prodBody").hidden=true;
}

/* ---------- maths ---------- */
function rollup(items){
  var n=0,d=0;
  items.forEach(function(it){
    var w=D.weights[it.w]||0, p=(D.states[it.state]||{pct:0}).pct;
    n+=w*p; d+=w;
  });
  return d? n/d : 0;
}
function barHTML(name,sub,pct,foot,cls){
  return '<div class="brow"><div class="bhead"><span class="bname">'+esc(name)+'</span>'+
    (sub?'<span class="bsub">'+esc(sub)+'</span>':'')+
    '<span class="bpct">'+pct.toFixed(1)+'%</span></div>'+
    '<div class="gauge"><div class="fill '+cls+'" style="width:0%" data-w="'+pct.toFixed(2)+'"></div></div>'+
    (foot?'<div class="bfoot">'+esc(foot)+'</div>':'')+'</div>';
}
function grow(node){
  requestAnimationFrame(function(){
    node.querySelectorAll(".fill").forEach(function(f){f.style.width=f.dataset.w+"%";});
  });
}

/* ---------- render ---------- */
function renderProduction(){
  var items=D.items||[];
  $("prodState").innerHTML="";
  $("prodBody").hidden=false;
  $("meta").textContent = (D.as_of?("as of "+D.as_of+"  ·  "):"")+items.length+" declared items";
  var hr=(D.doctrine&&D.doctrine.honesty_rule)||"";
  $("honesty").textContent=hr; $("honesty2").textContent=hr;

  var order=(D.gates||[]).map(function(g){return g.id;});
  $("gates").innerHTML=(D.gates||[]).map(function(g,i){
    var own=items.filter(function(it){return it.gate===g.id;});
    var cum=items.filter(function(it){return order.indexOf(it.gate)<=i;});
    return barHTML(g.name, own.length+" items  ·  cumulative "+rollup(cum).toFixed(1)+"%",
                   rollup(own), g.target, "f-brass");
  }).join(""); grow($("gates"));

  var ph=(D.pillars||[]).filter(function(p){return p.id!=="FOUNDATION";}).map(function(p){
    var set=items.filter(function(it){return it.pillar===p.id;});
    return barHTML(p.name, p.id+"  ·  "+set.length+" items", rollup(set), p.public, "f-verd");
  }).join("");
  var fset=items.filter(function(it){return it.pillar==="FOUNDATION";});
  ph+=barHTML("Foundation","never shown publicly  ·  "+fset.length+" items",rollup(fset),
    "Tooling, pipeline, funding and studio operations. Serves every pillar and belongs in no pillar figure.","f-copper");
  $("pillars").innerHTML=ph; grow($("pillars"));

  $("tracks").innerHTML=(D.tracks||[]).map(function(t){
    var set=items.filter(function(it){return it.track===t.id;});
    return barHTML(t.name, t.id+"  ·  "+set.length+" items", rollup(set), t.note, "f-brass");
  }).join(""); grow($("tracks"));

  $("states").innerHTML=Object.keys(D.states).map(function(k){
    var n=items.filter(function(it){return it.state===k;}).length;
    return '<div class="tile"><div class="k">'+esc(D.states[k].label)+'</div>'+
      '<div class="v" style="color:var('+SCOLOR[k]+')">'+n+'</div>'+
      '<div class="n">counts '+D.states[k].pct+'%</div></div>';
  }).join("");

  $("doctrine").innerHTML=Object.keys(D.doctrine||{}).map(function(k){
    return '<div class="brow"><div class="bname" style="font-size:12px;letter-spacing:.16em;'+
      'text-transform:uppercase;color:var(--muted)">'+esc(k.replace(/_/g," "))+'</div>'+
      '<div class="bfoot" style="color:var(--parch)">'+esc(D.doctrine[k])+'</div></div>';
  }).join("");

  buildFilters(); drawTable();
}

var sk="id", sd=1;
function fill(sel,vals,label){
  sel.innerHTML='<option value="">'+label+'</option>'+vals.map(function(v){
    return '<option value="'+esc(v[0])+'">'+esc(v[1])+'</option>';}).join("");
}
function buildFilters(){
  fill($("fG"),(D.gates||[]).map(function(g){return [g.id,g.name];}),"all gates");
  fill($("fT"),(D.tracks||[]).map(function(t){return [t.id,t.name];}),"all tracks");
  fill($("fS"),Object.keys(D.states).map(function(k){return [k,D.states[k].label];}),"all states");
  fill($("fP"),(D.pillars||[]).map(function(p){return [p.id,p.name];}),"all pillars");
  ["fG","fT","fS","fP","fQ"].forEach(function(id){$(id).addEventListener("input",drawTable);});
  document.querySelectorAll("#tbl th").forEach(function(th){
    function go(){ sd = th.dataset.s===sk ? -sd : 1; sk=th.dataset.s; drawTable(); }
    th.addEventListener("click",go);
    th.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
  });
}
function drawTable(){
  var q=$("fQ").value.toLowerCase(), g=$("fG").value, t=$("fT").value, s=$("fS").value, p=$("fP").value;
  var rows=(D.items||[]).filter(function(it){
    if(g&&it.gate!==g)return false; if(t&&it.track!==t)return false;
    if(s&&it.state!==s)return false; if(p&&it.pillar!==p)return false;
    if(q&&((it.name+" "+(it.ev||"")+" "+(it.note||"")+" "+it.id).toLowerCase().indexOf(q)<0))return false;
    return true;
  });
  rows.sort(function(a,b){
    var av,bv;
    if(sk==="pct"){av=D.states[a.state].pct;bv=D.states[b.state].pct;}
    else if(sk==="w"){av=D.weights[a.w];bv=D.weights[b.w];}
    else {av=String(a[sk]||"");bv=String(b[sk]||"");}
    return av<bv?-sd:av>bv?sd:0;
  });
  document.querySelector("#tbl tbody").innerHTML=rows.map(function(it){
    return '<tr><td class="m">'+esc(it.id)+'</td><td><div>'+esc(it.name)+'</div>'+
      (it.ev?'<div class="ev">'+esc(it.ev)+'</div>':'')+
      (it.note?'<div class="flag">'+esc(it.note)+'</div>':'')+'</td>'+
      '<td class="m">'+esc(it.gate)+'</td><td class="m">'+esc(it.track)+'</td>'+
      '<td class="m">'+esc(it.w)+'</td><td><span class="chip" style="background:var('+
      SCOLOR[it.state]+')">'+esc(D.states[it.state].label)+'</span></td></tr>';
  }).join("");
  $("cnt").textContent = rows.length+" of "+(D.items||[]).length+
    " items  ·  rollup of this selection "+rollup(rows).toFixed(1)+"%";
}

/* ---------- plan body ---------- */
function md(src){
  var out=[],lines=src.split(/\\r?\\n/),code=false,para=[];
  function inline(s){
    s=esc(s).replace(/\`([^\`]+)\`/g,"<code>$1</code>")
            .replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>")
            .replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g,'<a href="$2" rel="noreferrer">$1</a>');
    return s;
  }
  function flush(){ if(para.length){out.push("<p>"+inline(para.join(" "))+"</p>");para=[];} }
  for(var i=0;i<lines.length;i++){
    var L=lines[i];
    if(/^\\s*\`\`\`/.test(L)){flush(); out.push(code?"</pre>":"<pre>"); code=!code; continue;}
    if(code){out.push(esc(L)); continue;}
    var h=/^(#{1,4})\\s+(.*)$/.exec(L);
    if(h){flush(); var n=Math.min(h[1].length,3); out.push("<h"+n+">"+inline(h[2])+"</h"+n+">"); continue;}
    if(/^\\s*[-*]\\s+/.test(L)){flush(); out.push("<ul><li>"+inline(L.replace(/^\\s*[-*]\\s+/,""))+"</li></ul>"); continue;}
    if(/^\\s*>\\s?/.test(L)){flush(); out.push("<blockquote>"+inline(L.replace(/^\\s*>\\s?/,""))+"</blockquote>"); continue;}
    if(/^\\s*$/.test(L)){flush(); continue;}
    para.push(L);
  }
  flush();
  return out.join("\\n").replace(/<\\/ul>\\n<ul>/g,"");
}
function renderPlan(){
  if(SRC.plan && SRC.plan.text){
    $("planState").innerHTML="";
    $("plan").innerHTML=md(SRC.plan.text);
  } else {
    $("plan").innerHTML="";
    $("planState").innerHTML='<div class="state"><strong>The plan body is not filed yet.</strong> '+
      'This page is looking for <code>'+F_PLAN+'</code>'+
      (SRC.mode==="drive"?" in the Cogheim Drive folder":" at <code>./data/</code>")+
      '.<br><br>Export the current Master Index under that exact name. The filename never changes again, '+
      'so nothing downstream has to learn a new one.</div>';
  }
}
function renderSource(){
  function row(label,file,got){
    return '<div class="brow"><div class="bhead"><span class="bname" style="font-size:13px">'+esc(label)+
      '</span><span class="bsub">'+esc(file)+'</span></div><div class="bfoot">'+
      (got&&got.text ? "loaded, "+got.text.length.toLocaleString()+" characters"+
        (got.mtime?"  ·  modified "+esc(got.mtime.slice(0,10)):"")
       : "not found")+'</div></div>';
  }
  $("srcDetail").innerHTML='<div class="bars">'+
    '<div class="brow"><div class="bfoot" style="color:var(--parch)">Reading from '+
    (SRC.mode==="drive"
      ? "the Cogheim folder in your Google Drive, through your own connector, on every load."
      : "local files beside this page.")+'</div></div>'+
    row("Production data",F_JSON,SRC.json)+row("Plan body",F_PLAN,SRC.plan)+'</div>';
}
boot();
</script>

</body>
</html>
`;

const PRIVATE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

async function readDoc(db, name) {
  const { results } = await db
    .prepare("SELECT body FROM doc_chunk WHERE name = ? ORDER BY seq ASC")
    .bind(name)
    .all();
  if (!results || results.length === 0) return null;
  return results.map((r) => r.body).join("");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    // Everything outside /backstage is the existing public site.
    if (path !== "/backstage" && !path.startsWith("/backstage/")) {
      return env.ASSETS.fetch(request);
    }

    if (path === "/backstage") {
      return new Response(PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE_HEADERS },
      });
    }

    if (path === "/backstage/health") {
      const docs = await env.DB
        .prepare("SELECT name, chunk_count, updated_at, note FROM doc ORDER BY name")
        .all();
      const sweeps = await env.DB
        .prepare("SELECT ran_at, summary, report_file FROM sweep_log ORDER BY id DESC LIMIT 5")
        .all();
      return new Response(
        JSON.stringify({ docs: docs.results, recent_sweeps: sweeps.results }, null, 2),
        { headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE_HEADERS } }
      );
    }

    const m = path.match(/^\/backstage\/data\/(.+)$/);
    if (m) {
      const name = m[1];
      if (name !== "cogheim_production_status.json" && name !== "master_index.md") {
        return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
      }
      const body = await readDoc(env.DB, name);
      if (body === null) {
        return new Response("Not loaded yet", { status: 404, headers: PRIVATE_HEADERS });
      }
      const type = name.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "text/markdown; charset=utf-8";
      return new Response(body, { headers: { "Content-Type": type, ...PRIVATE_HEADERS } });
    }

    return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  },
};
