import { SEED_VIDEOS } from "./data/seed.videos.js";
import { syncPush, syncPull, syncEnabled, signUp, signIn, signOut, currentUser } from "./sync/supabase.js";

export function boot() {
var STORE = "v1";
function HEXOF(v){ var m = String(v).match(/#[0-9A-Fa-f]{6}/); return m ? m[0] : v; }
var HUES = ["#4F6B4A","#A67C22","#9E4F32","#4C6670","#6B5B7B","#7A6A4F","#5C6E52","#8C5B4A"];
var PRESETS = {
  "custom":{label:"Custom — I'll set the sections", correct:2, penalty:.5, sections:[]},
  "cgl":{label:"SSC CGL / CHSL Tier 1", correct:2, penalty:.5, sections:[
    {name:"Reasoning", q:25},{name:"General Awareness", q:25},{name:"Quantitative Aptitude", q:25},{name:"English", q:25}]},
  "cgl2":{label:"SSC CGL Tier 2 · Paper 1", correct:3, penalty:1, sections:[
    {name:"Mathematical Abilities", q:30},{name:"Reasoning & General Intelligence", q:30},
    {name:"English Language & Comprehension", q:45},{name:"General Awareness", q:25},
    {name:"Computer Knowledge", q:20}]},
  "chsl2":{label:"SSC CHSL Tier 2 · Session I", correct:3, penalty:1, sections:[
    {name:"Mathematical Abilities", q:30},{name:"Reasoning & General Intelligence", q:30},
    {name:"English Language & Comprehension", q:40},{name:"General Awareness", q:20},
    {name:"Computer Knowledge", q:15}]},
  "upscp":{label:"UPSC CSE Prelims · GS Paper I", correct:2, penalty:0.66, sections:[
    {name:"General Studies", q:100}]},
  "csat":{label:"UPSC CSE Prelims · CSAT", correct:2.5, penalty:0.83, sections:[
    {name:"CSAT", q:80}]},
  "cat":{label:"CAT", correct:3, penalty:1, sections:[
    {name:"VARC", q:24},{name:"DILR", q:22},{name:"Quantitative Ability", q:22}]},
  "ntpc":{label:"RRB NTPC CBT-1", correct:1, penalty:1/3, sections:[
    {name:"Mathematics", q:30},{name:"Reasoning", q:30},{name:"General Awareness", q:40}]},
  "groupd":{label:"RRB Group D", correct:1, penalty:1/3, sections:[
    {name:"Mathematics", q:25},{name:"Reasoning", q:30},{name:"General Science", q:25},{name:"GK & Current Affairs", q:20}]},
  "bank":{label:"Bank Prelims (PO / Clerk)", correct:1, penalty:.25, sections:[
    {name:"English", q:30},{name:"Reasoning", q:35},{name:"Quantitative Aptitude", q:35}]}
};
var MODES = {focus:{label:"Focus"}, short:{label:"Short break"}, long:{label:"Long break"}};
var state = {exams:[], mocks:[], sessions:[], notes:[], apps:[], videos:[], water:null, waterMin:false, dockUrl:"", focusLen:25, activeExam:null, activeNote:null};
var timer = {mode:"focus", running:false, endsAt:0, left:25*60000, subj:"general"};

var db = null, useIDB = true;
function openDB(){
  return new Promise(function(res){
    if(!window.indexedDB){ useIDB = false; return res(); }
    try{
      /* Chrome throws SecurityError here on file:// pages — catch it so boot continues */
      var req = indexedDB.open("singularity-" + STORE, 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore("kv"); };
      req.onsuccess = function(){ db = req.result; res(); };
      req.onerror = function(){ useIDB = false; res(); };
    }catch(e){ useIDB = false; res(); }
  });
}
function idbGet(){
  return new Promise(function(res){
    if(!db) return res(null);
    try{
      var tx = db.transaction("kv","readonly").objectStore("kv").get("state");
      tx.onsuccess = function(){ res(tx.result || null); };
      tx.onerror = function(){ res(null); };
    }catch(e){ res(null); }
  });
}
function idbSet(v){
  if(!db) return;
  try{ db.transaction("kv","readwrite").objectStore("kv").put(v, "state"); }catch(e){}
}
function snapshot(){
  return {v:4, exams:state.exams, mocks:state.mocks, sessions:state.sessions, notes:state.notes, apps:state.apps, videos:state.videos, water:state.water, waterMin:state.waterMin, dockUrl:state.dockUrl,
          focusLen:state.focusLen, activeExam:state.activeExam,
          timer:{mode:timer.mode, running:timer.running, endsAt:timer.endsAt, left:timer.left, subj:timer.subj}};
}
var saveTimer;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    var s = snapshot();
    if(useIDB && db) idbSet(s);
    try{ localStorage.setItem("singularity." + STORE, JSON.stringify(s)); }catch(e){}
  }, 120);
  autoPush();
}
function applyStored(s){
  if(!s) return;
  ["exams","mocks","sessions","notes","apps","videos"].forEach(function(k){ if(Array.isArray(s[k])) state[k] = s[k]; });
  if(typeof s.focusLen === "number") state.focusLen = s.focusLen;
  if(typeof s.dockUrl === "string") state.dockUrl = s.dockUrl;
  if(s.water) state.water = s.water;
  if(typeof s.waterMin === "boolean") state.waterMin = s.waterMin;
  if(s.activeExam) state.activeExam = s.activeExam;
  if(s.timer){
    timer.mode = MODES[s.timer.mode] ? s.timer.mode : "focus";
    timer.subj = s.timer.subj || "general";
    timer.running = !!s.timer.running;
    timer.endsAt = s.timer.endsAt || 0;
    timer.left = typeof s.timer.left === "number" ? s.timer.left : state.focusLen*60000;
  }
}
var $ = function(id){ return document.getElementById(id); };
function uid(p){ return (p||"") + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function clamp(n,lo,hi){ n = isFinite(n) ? n : 0; return Math.max(lo, Math.min(hi, n)); }
function fmt(n){ var r = Math.round(n*10)/10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function dayKey(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function today(){ return dayKey(new Date()); }
function examOf(id){ for(var i=0;i<state.exams.length;i++){ if(state.exams[i].id === id) return state.exams[i]; } return null; }
function mocksOf(id){ return state.mocks.filter(function(m){ return m.examId === id; }); }
function examMax(ex){ return ex.sections.reduce(function(t,s){ return t + s.q*ex.correct; }, 0); }
function hasCounts(v){ return !!v && typeof v.c === "number"; }
function secMarks(v, ex){
  if(!v) return 0;
  if(typeof v.m === "number") return v.m;
  return v.c*ex.correct - v.w*ex.penalty;
}
function mockScore(m, ex){
  var t = 0;
  ex.sections.forEach(function(S){ t += secMarks(m.sections[S.k || S.key], ex); });
  return t;
}
function mockAttempted(m){ var t=0; for(var k in m.sections){ if(hasCounts(m.sections[k])) t += m.sections[k].c + m.sections[k].w; } return t; }
function mockCorrect(m){ var t=0; for(var k in m.sections){ if(hasCounts(m.sections[k])) t += m.sections[k].c; } return t; }
function sectionsOf(m, ex){
  return ex.sections.filter(function(S){ return m.sections[S.key]; });
}
function mockHasCounts(m){ for(var k in m.sections){ if(hasCounts(m.sections[k])) return true; } return false; }
function sortMocks(){
  state.mocks.forEach(function(m,i){ if(typeof m.seq !== "number") m.seq = i; });
  state.mocks.sort(function(a,b){
    var ad = a.date || "", bd = b.date || "";
    if(ad && bd) return ad < bd ? -1 : (ad > bd ? 1 : a.seq - b.seq);
    if(!ad && !bd) return a.seq - b.seq;
    return ad ? 1 : -1;
  });
  state.mocks.forEach(function(m,i){ m.seq = i; });
}
function isFocus(s){ return (s.kind || "focus") === "focus"; }
function humanMins(m){ m = Math.round(m); return m < 60 ? m+"m" : Math.floor(m/60)+"h"+(m%60 ? " "+(m%60)+"m" : ""); }
function mmss(ms){ var s = Math.max(0,Math.ceil(ms/1000)), mi = Math.floor(s/60); return (mi<10?"0":"")+mi+":"+((s%60)<10?"0":"")+(s%60); }

var toastT;
function toast(msg){
  var el = $("toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(function(){ el.classList.remove("on"); }, 2500);
}
var TABS = ["timer","mocks","analytics","watch","apps","notes","data"];
function showTab(name){
  if(TABS.indexOf(name) < 0) name = "timer";
  TABS.forEach(function(n){ $("p-"+n).classList.toggle("on", n === name); });
  $("tabs").querySelectorAll("button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-t") === name); });
  if(location.hash.slice(1) !== name){ try{ history.replaceState(null, "", "#"+name); }catch(e){} }
  window.scrollTo(0,0);
  if(name === "analytics") renderAnalytics();
  if(name === "mocks") renderExams();
  if(name !== "notes") commitNote(true);
  if(name === "notes") renderNotes();
  if(name === "apps"){ renderApps(); renderFeed(); }
  if(name === "watch") renderVideos();
  if(name === "data") renderSync();
}
function makeExam(name, presetKey, customSections, correct, penalty){
  var p = PRESETS[presetKey] || PRESETS.custom;
  var secs = (presetKey === "custom" ? customSections : p.sections) || [];
  return {
    id: uid("ex"), name: name,
    correct: presetKey === "custom" ? correct : p.correct,
    penalty: presetKey === "custom" ? penalty : p.penalty,
    open: true,
    sections: secs.map(function(s,i){
      return {key:"s"+i, name:s.name, q:s.q, hue:HUES[i % HUES.length]};
    })
  };
}
function renderExams(){
  var host = $("exam-list");
  if(!state.exams.length){
    host.innerHTML = '<div class="card empty"><h3>No exams yet</h3><p>Add one below. Each exam keeps its own sections, marking scheme and mocks.</p></div>';
    return;
  }
  host.innerHTML = state.exams.map(function(ex){
    var ms = mocksOf(ex.id);
    var lf = logFilter[ex.id] || "all";
    var shownMocks = ms.filter(function(m){
      if(lf === "all") return true;
      if(lf === "full") return m.type === "full";
      if(lf === "sectional") return m.type !== "full";
      return m.type !== "full" && m.sections[lf];
    });
    var full = ms.filter(function(m){ return m.type === "full"; });
    var avg = full.length ? full.reduce(function(t,m){ return t + mockScore(m, ex); },0)/full.length : null;
    return '<div class="card exam'+(ex.open ? " open" : "")+'" data-ex="'+ex.id+'">'+
      '<div class="exam-head" data-act="toggle"><span class="caret">▶</span><h3>'+esc(ex.name)+'</h3>'+
        '<span class="pill">'+ex.sections.length+' sections · '+examMax(ex)+' marks</span>'+
        '<span class="meta">'+ms.length+' logged'+(avg !== null ? ' · avg '+fmt(avg) : '')+'</span>'+
        '<button class="del" type="button" data-act="delex" aria-label="Delete exam">×</button></div>'+
      '<div class="exam-body">'+
        '<div class="entry-launch"><button class="btn sm" type="button" data-act="open-entry">Log a mock</button></div>'+
        '<div class="entry" data-entry hidden></div>'+
        (ms.length ? '<div class="loglabel"><span class="eyebrow">Logged</span>'+
          '<select data-logfilter>'+
            '<option value="all"'+(lf==="all"?" selected":"")+'>All ('+ms.length+')</option>'+
            '<option value="full"'+(lf==="full"?" selected":"")+'>Full length ('+ms.filter(function(m){return m.type==="full";}).length+')</option>'+
            '<option value="sectional"'+(lf==="sectional"?" selected":"")+'>Sectional ('+ms.filter(function(m){return m.type!=="full";}).length+')</option>'+
            ex.sections.map(function(S){
              var c = ms.filter(function(m){ return m.type!=="full" && m.sections[S.key]; }).length;
              return c ? '<option value="'+S.key+'"'+(lf===S.key?" selected":"")+'>'+esc(S.name)+' ('+c+')</option>' : "";
            }).join("")+
          '</select></div>' + shownMocks.slice().reverse().map(function(m){
          var tags = (m.type === "full"
            ? '<i class="tag full">Full length</i>'
            : sectionsOf(m, ex).map(function(S){
                return '<i class="tag" style="--hue:'+S.hue+'">'+esc(S.name)+' · '+fmt(secMarks(m.sections[S.key], ex))+'</i>'; }).join(""));
          if(mockHasCounts(m)){
            tags += '<i class="tag right">'+mockCorrect(m)+' right</i>'+
                    '<i class="tag wrong">'+(mockAttempted(m)-mockCorrect(m))+' wrong</i>'+
                    '<i class="tag ghost">'+mockAttempted(m)+' attempted</i>';
          } else tags += '<i class="tag ghost">marks only</i>';
          if(typeof m.pct === "number") tags += '<i class="tag ghost">'+m.pct+' %ile</i>';
          var meta = (m.date || "no date") + (m.note ? " · " + m.note : "");
          return '<div class="mock-row"'+(m.note ? ' title="'+esc(m.note)+'"' : '')+'><span class="nm"><b>'+esc(m.name)+'</b>'+
            '<span class="tags">'+tags+'</span><span>'+esc(meta)+'</span></span>'+
            '<span class="sc">'+fmt(mockScore(m, ex))+'<small>'+(m.type === "full" ? "of "+examMax(ex) : "sectional")+'</small></span>'+
            '<button class="del" type="button" data-act="delmock" data-id="'+m.id+'" aria-label="Delete mock">×</button></div>';
        }).join("") : '<p class="status" style="margin:12px 0 0">Nothing logged for this exam yet.</p>')+
      '</div></div>';
  }).join("");
}

var logFilter = {};
/* entry form inside an exam */
var draft = {};
function openEntry(exId, box){
  var ex = examOf(exId);
  draft[exId] = {type:"full", section: ex.sections[0] ? ex.sections[0].key : null, vals:{}};
  ex.sections.forEach(function(S){ draft[exId].vals[S.key] = {c:0,w:0}; });
  box.hidden = false;
  paintEntry(exId, box);
}
/* base names only — "Blitz 14" and "Blitz 7" collapse to one "Blitz" suggestion */
function nameStem(n){
  return String(n||"").trim()
    .replace(/[\s\-_]*[#(]?\d+[)]?\s*$/,"")   // trailing number, with or without brackets
    .replace(/\s{2,}/g," ").trim();
}
function nameStems(exId){
  var counts = {};
  state.mocks.forEach(function(m){
    var stem = nameStem(m.name);
    if(!stem || /^(Imported|Mock)$/i.test(stem)) return;
    counts[stem] = (counts[stem] || 0) + (m.examId === exId ? 2 : 1);
  });
  return Object.keys(counts)
    .sort(function(a,b){ return counts[b] - counts[a] || a.localeCompare(b); })
    .slice(0,8);
}
/* "Blitz" -> "Blitz 20" when Blitz 19 is the highest already logged */
function nextName(stem, exId){
  var top = 0, seen = false;
  state.mocks.forEach(function(m){
    if(nameStem(m.name).toLowerCase() !== stem.toLowerCase()) return;
    seen = true;
    var mm = String(m.name).match(/(\d+)\s*[)]?$/);
    if(mm) top = Math.max(top, +mm[1]);
  });
  return top ? stem + " " + (top+1) : stem;
}
function paintEntry(exId, box){
  var ex = examOf(exId), d = draft[exId];
  var shown = d.type === "full" ? ex.sections : ex.sections.filter(function(S){ return S.key === d.section; });
  var stems = nameStems(exId);
  var total = 0, att = 0, corr = 0;
  shown.forEach(function(S){
    var v = d.vals[S.key];
    total += v.c*ex.correct - v.w*ex.penalty; att += v.c+v.w; corr += v.c;
  });
  box.innerHTML =
    '<div class="row" style="align-items:center">'+
      '<div class="seg"><button type="button" data-type="full" class="'+(d.type==="full"?"on":"")+'">Full length</button>'+
      '<button type="button" data-type="sectional" class="'+(d.type==="sectional"?"on":"")+'">Sectional</button></div>'+
      (d.type === "sectional" ? '<select data-sec>'+ex.sections.map(function(S){
        return '<option value="'+S.key+'"'+(S.key===d.section?" selected":"")+'>'+esc(S.name)+'</option>'; }).join("")+'</select>' : "")+
    '</div>'+
    '<div class="row" style="margin-top:10px">'+
      '<div class="field" style="flex:1 1 240px"><label>Mock name</label>'+
        '<input type="text" data-name autocomplete="off" placeholder="Type a name" value="'+esc(d.name||"")+'">'+
        (stems.length ? '<div class="stems">'+stems.map(function(s){
          return '<button type="button" class="stem" data-stem="'+esc(s)+'">'+esc(s)+'</button>'; }).join("")+'</div>' : "")+
        '</div>'+
      '<div class="field"><label>Date</label><input type="date" data-date value="'+(d.date||today())+'"></div>'+
      '<div class="field" style="flex:1 1 100%"><label>Remark</label>'+
      '<input type="text" data-note placeholder="What went wrong, what to revise" value="'+esc(d.note||"")+'"></div>'+
    '</div>'+
    '<div class="srow shead"><span class="sn"></span>'+
      '<span class="hcap right">Right</span><span class="hcap wrong">Wrong</span>'+
      '<span class="hcap">Skipped</span><span class="hcap end">Marks</span></div>'+
    shown.map(function(S){
      var v = d.vals[S.key];
      return '<div class="srow" style="--hue:'+S.hue+'"><span class="sn">'+esc(S.name)+' <span class="eyebrow">/'+S.q+'</span></span>'+
        '<span class="step right" data-k="'+S.key+'" data-f="c"><button type="button" data-d="-1">−</button>'+
        '<input type="number" value="'+v.c+'" min="0" max="'+S.q+'" aria-label="Correct in '+esc(S.name)+'">'+
        '<button type="button" data-d="1">+</button></span>'+
        '<span class="step wrong" data-k="'+S.key+'" data-f="w"><button type="button" data-d="-1">−</button>'+
        '<input type="number" value="'+v.w+'" min="0" max="'+S.q+'" aria-label="Wrong in '+esc(S.name)+'">'+
        '<button type="button" data-d="1">+</button></span>'+
        '<span class="skip">'+(S.q - v.c - v.w)+'</span>'+
        '<span class="rs">'+fmt(v.c*ex.correct - v.w*ex.penalty)+'</span></div>';
    }).join("")+
    '<div class="entry-foot"><span class="tot"><span class="eyebrow">Total</span><span class="n">'+fmt(total)+'</span>'+
      '<span class="eyebrow">'+att+' attempted · '+(att?Math.round(corr/att*100):0)+'% accuracy</span></span>'+
      '<button class="btn ghost sm" type="button" data-act="cancel-entry">Cancel</button>'+
      '<button class="btn" type="button" data-act="save-entry"'+(att?"":" disabled")+'>Save mock</button></div>';
}

/* delegated events for the mocks tab */
$("p-mocks").addEventListener("click", function(e){
  var t = e.target;
  var examEl = t.closest("[data-ex]"); if(!examEl) return;
  var exId = examEl.getAttribute("data-ex");
  var box = examEl.querySelector("[data-entry]");
  var act = t.getAttribute("data-act") || (t.closest("[data-act]") && t.closest("[data-act]").getAttribute("data-act"));

  if(act === "delex"){
    e.stopPropagation();
    if(!confirm("Delete this exam and all its mocks?")) return;
    state.exams = state.exams.filter(function(x){ return x.id !== exId; });
    state.mocks = state.mocks.filter(function(m){ return m.examId !== exId; });
    if(state.activeExam === exId) state.activeExam = state.exams[0] ? state.exams[0].id : null;
    save(); renderExams(); refreshSelectors(); return;
  }
  if(act === "toggle"){
    var ex = examOf(exId); ex.open = !ex.open; save(); examEl.classList.toggle("open", ex.open); return;
  }
  if(act === "delmock"){
    var id = t.getAttribute("data-id");
    state.mocks = state.mocks.filter(function(m){ return m.id !== id; });
    save(); liveRefresh(); renderExams(); return;
  }
  if(act === "open-entry"){ openEntry(exId, box); return; }
  if(act === "cancel-entry"){ box.hidden = true; box.innerHTML = ""; return; }

  if(t.matches(".stem")){
    stashMeta(exId, box);
    draft[exId].name = nextName(t.getAttribute("data-stem"), exId);
    paintEntry(exId, box);
    var f = box.querySelector("[data-name]"); if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    return;
  }
  if(t.matches(".seg button")){ draft[exId].type = t.getAttribute("data-type"); paintEntry(exId, box); return; }
  if(t.matches(".step button")){
    var step = t.closest(".step"), k = step.getAttribute("data-k"), f = step.getAttribute("data-f");
    var ex2 = examOf(exId), S = ex2.sections.filter(function(x){ return x.key === k; })[0];
    var d = draft[exId], other = f === "c" ? "w" : "c";
    var v = clamp(d.vals[k][f] + Number(t.getAttribute("data-d")), 0, S.q);
    if(v + d.vals[k][other] > S.q) v = S.q - d.vals[k][other];
    d.vals[k][f] = v;
    stashMeta(exId, box); paintEntry(exId, box); return;
  }
  if(act === "save-entry"){
    stashMeta(exId, box);
    var ex3 = examOf(exId), d3 = draft[exId];
    var secs = {};
    var list = d3.type === "full" ? ex3.sections : ex3.sections.filter(function(S){ return S.key === d3.section; });
    var any = 0;
    list.forEach(function(S){ secs[S.key] = {c:d3.vals[S.key].c, w:d3.vals[S.key].w}; any += d3.vals[S.key].c + d3.vals[S.key].w; });
    if(!any){ toast("Enter at least one question"); return; }
    var rec = {id:uid("mk"), examId:exId, name: d3.name || ("Mock " + (mocksOf(exId).length+1)),
               date: d3.date || today(), type: d3.type, sections: secs};
    if(d3.note && d3.note.trim()) rec.note = d3.note.trim();
    state.mocks.push(rec);
    sortMocks();
    save(); box.hidden = true; box.innerHTML = ""; renderExams();
    toast("Mock saved");
  }
});
$("p-mocks").addEventListener("change", function(e){
  var examEl = e.target.closest("[data-ex]"); if(!examEl) return;
  var exId = examEl.getAttribute("data-ex"), box = examEl.querySelector("[data-entry]");
  if(e.target.matches("[data-sec]")){ draft[exId].section = e.target.value; paintEntry(exId, box); }
  if(e.target.matches("[data-logfilter]")){ logFilter[exId] = e.target.value; renderExams();
    var card = $("exam-list").querySelector('[data-ex="'+exId+'"]');
    if(card){ var s = card.querySelector("[data-logfilter]"); if(s) s.focus(); } }
});
$("p-mocks").addEventListener("input", function(e){
  var examEl = e.target.closest("[data-ex]"); if(!examEl) return;
  var exId = examEl.getAttribute("data-ex"), box = examEl.querySelector("[data-entry]");
  if(e.target.matches(".step input")){
    var step = e.target.closest(".step"), k = step.getAttribute("data-k"), f = step.getAttribute("data-f");
    var ex = examOf(exId), S = ex.sections.filter(function(x){ return x.key === k; })[0];
    var d = draft[exId], other = f === "c" ? "w" : "c";
    var v = clamp(Math.round(parseInt(e.target.value,10)||0), 0, S.q);
    if(v + d.vals[k][other] > S.q) v = S.q - d.vals[k][other];
    d.vals[k][f] = v;
    stashMeta(exId, box); paintEntry(exId, box);
  }
});
function stashMeta(exId, box){
  var n = box.querySelector("[data-name]"), dt = box.querySelector("[data-date]");
  if(n) draft[exId].name = n.value;
  if(dt) draft[exId].date = dt.value;
  var nt = box.querySelector("[data-note]");
  if(nt) draft[exId].note = nt.value;
}
var customSecs = [{name:"", q:25}];
function renderPresetSelect(){
  $("new-preset").innerHTML = Object.keys(PRESETS).map(function(k){
    return '<option value="'+k+'"'+(k==="custom"?" selected":"")+'>'+esc(PRESETS[k].label)+'</option>';
  }).join("");
  $("custom-builder").hidden = false;
}
function renderCustomRows(){
  $("custom-rows").innerHTML = customSecs.map(function(s,i){
    return '<div class="row" style="margin-bottom:7px">'+
      '<input type="text" data-cs="'+i+'" data-f="name" placeholder="Section name" value="'+esc(s.name)+'" style="flex:1 1 160px">'+
      '<input type="number" data-cs="'+i+'" data-f="q" value="'+s.q+'" min="1" max="200" style="width:78px" aria-label="Questions">'+
      '<button class="btn ghost tiny" type="button" data-rm="'+i+'">Remove</button></div>';
  }).join("");
}
$("new-preset").addEventListener("change", function(){
  var custom = $("new-preset").value === "custom";
  $("custom-builder").hidden = !custom;
  if(custom) renderCustomRows();
});
$("custom-rows").addEventListener("input", function(e){
  var i = e.target.getAttribute("data-cs"); if(i === null) return;
  var f = e.target.getAttribute("data-f");
  customSecs[+i][f] = f === "q" ? clamp(parseInt(e.target.value,10)||1, 1, 200) : e.target.value;
});
$("custom-rows").addEventListener("click", function(e){
  var i = e.target.getAttribute("data-rm"); if(i === null) return;
  customSecs.splice(+i,1); if(!customSecs.length) customSecs = [{name:"",q:25}];
  renderCustomRows();
});
$("add-section").addEventListener("click", function(){ customSecs.push({name:"", q:25}); renderCustomRows(); });
function openNewExam(on){
  $("new-exam-card").hidden = !on;
  $("new-exam-open").hidden = on;
  if(on){
    $("new-preset").value = "custom";
    $("custom-builder").hidden = false;
    renderCustomRows();
    $("new-exam").focus();
  }
}
$("new-exam-open").addEventListener("click", function(){ openNewExam(true); });
$("new-exam-close").addEventListener("click", function(){ openNewExam(false); });
$("add-exam").addEventListener("click", function(){
  var name = $("new-exam").value.trim();
  if(!name){ toast("Give the exam a name"); return; }
  var preset = $("new-preset").value;
  var secs = customSecs.filter(function(s){ return s.name.trim(); });
  if(preset === "custom" && !secs.length){ toast("Add at least one section"); return; }
  var ex = makeExam(name, preset, secs, Number($("cust-correct").value)||2, Number($("cust-penalty").value)||0);
  state.exams.push(ex);
  if(!state.activeExam) state.activeExam = ex.id;
  $("new-exam").value = ""; customSecs = [{name:"",q:25}]; renderCustomRows();
  save(); renderExams(); refreshSelectors(); openNewExam(false); toast("Added " + name);
});
function renderAnalytics(){
  var ex = examOf($("an-exam").value) || examOf(state.activeExam) || state.exams[0];
  if(!ex){
    $("s-count").textContent = "0";
    ["s-best","s-avg","s-recent","s-acc"].forEach(function(id){ $(id).textContent = "—"; });
    $("secgrid").innerHTML = '<div class="card empty"><h3>No exam yet</h3><p>Add an exam on the Mocks tab first.</p></div>';
    renderChart(null, []); renderStudy(); return;
  }
  var all = mocksOf(ex.id), full = all.filter(function(m){ return m.type === "full"; });
  var sectionalOnly = all.filter(function(m){ return m.type !== "full"; });

  $("s-count").textContent = full.length;
  if(full.length){
    var scores = full.map(function(m){ return mockScore(m, ex); });
    var best = Math.max.apply(null, scores), bi = scores.indexOf(best);
    $("s-best").textContent = fmt(best);
    $("s-best-sub").textContent = full[bi].name;
    $("s-avg").textContent = fmt(scores.reduce(function(a,b){ return a+b; },0)/scores.length);
    var last = scores.slice(-5);
    $("s-recent").textContent = fmt(last.reduce(function(a,b){ return a+b; },0)/last.length);
    /* accuracy only means something for rows that recorded right and wrong counts */
    var counted = full.filter(mockHasCounts), cc = 0, at = 0;
    counted.forEach(function(m){ cc += mockCorrect(m); at += mockAttempted(m); });
    if(at){
      $("s-acc").textContent = Math.round(cc/at*100) + "%";
      $("s-acc-sub").textContent = Math.round(at/counted.length) + " attempted on average" +
        (counted.length < full.length ? " · from " + counted.length + " of " + full.length : "");
    } else {
      $("s-acc").textContent = "—";
      $("s-acc-sub").textContent = "these mocks store marks only";
    }
  } else {
    ["s-best","s-avg","s-recent","s-acc"].forEach(function(id){ $(id).textContent = "—"; });
    $("s-best-sub").innerHTML = "&nbsp;"; $("s-acc-sub").innerHTML = "&nbsp;";
  }

  var scope = $("sec-scope").value || "all";
  var pool = scope === "full" ? full : scope === "sectional" ? sectionalOnly : all;
  var stats = ex.sections.map(function(S){
    var rel = pool.filter(function(m){ return m.sections[S.key]; });
    var sum = 0, c = 0, at = 0, counted = 0, recent = [];
    rel.forEach(function(m){
      var v = m.sections[S.key];
      sum += secMarks(v, ex);
      if(hasCounts(v)){ c += v.c; at += v.c + v.w; counted++; }
    });
    recent = rel.slice(-5).map(function(m){ return secMarks(m.sections[S.key], ex); });
    var max = S.q * ex.correct;
    return {S:S, n:rel.length, counted:counted, max:max,
            avg: rel.length ? sum/rel.length : 0,
            recent: recent.length ? recent.reduce(function(a,b){ return a+b; },0)/recent.length : 0,
            acc: at ? c/at*100 : null, att: counted ? at/counted : null};
  });

  var withData = stats.filter(function(s){ return s.n; }), weakKey = null;
  if(withData.length){
    var weak = withData.slice().sort(function(a,b){ return (a.avg/a.max) - (b.avg/b.max); })[0];
    weakKey = weak.S.key;
    $("sec-verdict").textContent = "Weakest share of marks: " + weak.S.name +
      " — " + fmt(weak.avg) + " of " + weak.max + " (" + Math.round(weak.avg/weak.max*100) + "%)";
  } else $("sec-verdict").innerHTML = "&nbsp;";

  $("secgrid").innerHTML = stats.map(function(st){
    /* bar shows accuracy where counts exist, otherwise share of the section's marks */
    var barPct = st.acc !== null ? st.acc : (st.n ? st.avg/st.max*100 : 0);
    var barLabel = st.acc !== null ? Math.round(st.acc) + "% accurate" : Math.round(barPct) + "% of marks";
    var rightLabel = st.att !== null ? Math.round(st.att) + "/" + st.S.q + " tried"
                   : (st.n ? "last 5: " + fmt(st.recent) : "no data");
    var trend = st.n > 1 ? st.recent - st.avg : 0;
    return '<div class="seccard" style="--hue:'+st.S.hue+'">'+(st.S.key === weakKey ? '<span class="flag">FIX FIRST</span>' : "")+
      '<span class="eyebrow">'+st.n+' logged</span><h3>'+esc(st.S.name)+'</h3>'+
      '<span class="avg">'+(st.n ? fmt(st.avg) : "—")+'</span><span class="of">average of '+st.max+
      (st.n > 1 ? ' · last 5 ' + (trend >= 0 ? "+" : "") + fmt(trend) : "")+'</span>'+
      '<div class="acc-track"><div class="acc-fill" style="width:'+clamp(barPct,0,100).toFixed(0)+'%"></div></div>'+
      '<div class="acc-meta"><span>'+barLabel+'</span><span>'+rightLabel+'</span></div></div>';
  }).join("");

  if($("trend-scope").value === "sectional"){
    var series = ex.sections.map(function(S){
      var vals = sectionalOnly.filter(function(m){ return m.sections[S.key]; })
        .map(function(m){ return {v: secMarks(m.sections[S.key], ex), m:m}; });
      return {label:S.name, hue:HEXOF(S.hue), values:vals, max:S.q*ex.correct};
    }).filter(function(s){ return s.values.length; });
    var top = series.length ? Math.max.apply(null, series.map(function(s){ return s.max; })) : 50;
    renderChart(ex, series, top, false);
  } else {
    renderChart(ex, [{label:"Score", hue:"#BE5103",
      values: full.map(function(m){ return {v:mockScore(m, ex), m:m}; }), max:examMax(ex)}], examMax(ex), true);
  }
  renderStudy();
}

var chartPts = [], chartMeta = null;
function smoothPath(pts){
  if(pts.length < 2) return "";
  var d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
  for(var i=0;i<pts.length-1;i++){
    var p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || pts[i+1];
    var c1x = p1.x + (p2.x - p0.x)/6, c1y = p1.y + (p2.y - p0.y)/6;
    var c2x = p2.x - (p3.x - p1.x)/6, c2y = p2.y - (p3.y - p1.y)/6;
    d += " C " + c1x.toFixed(1) + " " + c1y.toFixed(1) + ", " + c2x.toFixed(1) + " " + c2y.toFixed(1) +
         ", " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
  }
  return d;
}
function renderChart(ex, series, max, withAvg){
  var svg = $("chart"), W=720, H=250, L=42, R=18, T=18, B=30, iw=W-L-R, ih=H-T-B, out="";
  max = max || 200;
  function y(v){ return T + ih - (clamp(v,0,max)/max)*ih; }
  chartPts = [];

  var defs = '<defs>';
  (series||[]).forEach(function(s,si){
    defs += '<linearGradient id="fg'+si+'" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="'+s.hue+'" stop-opacity="'+(series.length>1?".22":".34")+'"/>'+
      '<stop offset="100%" stop-color="'+s.hue+'" stop-opacity="0"/></linearGradient>';
  });
  out += defs + '</defs>';

  [0,.25,.5,.75,1].forEach(function(f){
    var g = Math.round(max*f);
    out += '<line x1="'+L+'" y1="'+y(g).toFixed(1)+'" x2="'+(W-R)+'" y2="'+y(g).toFixed(1)+
           '" stroke="rgba(61,46,34,.09)" stroke-dasharray="'+(f===0?"0":"2 6")+'"/>'+
           '<text x="'+(L-10)+'" y="'+(y(g)+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#A08D79">'+g+'</text>';
  });

  var live = (series||[]).filter(function(s){ return s.values.length; });
  if(!live.length){
    out += '<text x="'+(L+iw/2)+'" y="'+(T+ih/2)+'" text-anchor="middle" font-size="12" fill="#A08D79">Nothing logged for this view yet</text>';
    svg.innerHTML = out; $("chart-legend").innerHTML = ""; $("chart-tip").hidden = true; return;
  }

  var longest = Math.max.apply(null, live.map(function(s){ return s.values.length; }));
  live.forEach(function(s, si){
    var n = s.values.length, step = n>1 ? iw/(n-1) : 0;
    var pts = s.values.map(function(d,i){
      return {x: n>1 ? L+i*step : L+iw/2, y:y(d.v), v:d.v, m:d.m, label:s.label, hue:s.hue};
    });
    chartPts = chartPts.concat(pts);
    var path = smoothPath(pts);
    if(n > 1){
      out += '<path d="'+path+' L '+pts[n-1].x.toFixed(1)+' '+(T+ih)+' L '+pts[0].x.toFixed(1)+' '+(T+ih)+' Z" fill="url(#fg'+si+')"/>';
      out += '<path d="'+path+'" fill="none" stroke="'+s.hue+'" stroke-width="'+(live.length>1?"2.2":"2.6")+
             '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    }
    out += '<circle cx="'+pts[n-1].x.toFixed(1)+'" cy="'+pts[n-1].y.toFixed(1)+'" r="5" fill="'+s.hue+'" stroke="#FFFBF3" stroke-width="2.5"/>';
  });

  if(withAvg && live[0].values.length > 4){
    var v = live[0].values, n2 = v.length, step2 = n2>1 ? iw/(n2-1) : 0;
    var avg = v.map(function(d,i){
      var from = Math.max(0,i-4), sl = v.slice(from,i+1);
      return {x:L+i*step2, y:y(sl.reduce(function(a,b){ return a+b.v; },0)/sl.length)};
    });
    out += '<path d="'+smoothPath(avg)+'" fill="none" stroke="#6C71A6" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round" opacity=".85" vector-effect="non-scaling-stroke"/>';
  }

  [0, Math.floor((longest-1)/2), longest-1].filter(function(x,i,a){ return x>=0 && a.indexOf(x)===i; })
    .forEach(function(i){
      var xx = longest>1 ? L + i*(iw/(longest-1)) : L+iw/2;
      out += '<text x="'+xx.toFixed(1)+'" y="'+(H-9)+'" text-anchor="middle" font-size="10.5" fill="#A08D79">'+(i+1)+'</text>';
    });

  out += '<g id="hover-g" opacity="0"><line id="hover-line" y1="'+T+'" y2="'+(T+ih)+'" stroke="rgba(61,46,34,.25)"/>'+
         '<circle id="hover-dot" r="6" fill="#BE5103" stroke="#FFFBF3" stroke-width="2.5"/></g>';
  out += '<rect id="hover-hit" x="'+L+'" y="'+T+'" width="'+iw+'" height="'+ih+'" fill="transparent" style="cursor:crosshair"/>';
  svg.innerHTML = out;

  $("chart-legend").innerHTML = live.map(function(s){
    return '<span><i class="sw" style="background:'+s.hue+'"></i>'+esc(s.label)+' · '+s.values.length+'</span>';
  }).join("") + (withAvg && live[0].values.length > 4 ? '<span><i class="sw avgline"></i>5-mock average</span>' : "");
  bindHover();
}

function bindHover(){
  var hit = $("hover-hit"); if(!hit) return;
  var svg = $("chart"), tip = $("chart-tip"), g = $("hover-g");
  function move(clientX){
    var box = svg.getBoundingClientRect();
    var vx = (clientX - box.left) / box.width * 720;
    var box2 = svg.getBoundingClientRect();
    var best = null, bd = 1e9;
    chartPts.forEach(function(p){ var d = Math.abs(p.x - vx); if(d < bd){ bd = d; best = p; } });
    if(!best) return;
    g.setAttribute("opacity","1");
    $("hover-line").setAttribute("x1", best.x); $("hover-line").setAttribute("x2", best.x);
    $("hover-dot").setAttribute("cx", best.x); $("hover-dot").setAttribute("cy", best.y);
    tip.hidden = false;
    $("hover-dot").setAttribute("fill", best.hue || "#BE5103");
    tip.innerHTML = '<b>'+esc(best.m.name)+'</b><span>'+(best.label ? esc(best.label)+' · ' : '')+fmt(best.v)+
      (best.m.date ? ' · '+best.m.date : '')+(typeof best.m.pct === "number" ? ' · '+best.m.pct+' %ile' : '')+'</span>';
    var px = best.x / 720 * box.width;
    tip.style.left = clamp(px, 60, box.width - 60) + "px";
    tip.style.top = (best.y / 250 * box.height - 12) + "px";
  }
  hit.addEventListener("mousemove", function(e){ move(e.clientX); });
  hit.addEventListener("touchmove", function(e){ if(e.touches[0]) move(e.touches[0].clientX); }, {passive:true});
  hit.addEventListener("mouseleave", function(){ g.setAttribute("opacity","0"); tip.hidden = true; });
}

function renderStudy(){
  var t = today(), byDay = {}, bySubj = {}, breakByDay = {};
  state.sessions.forEach(function(s){
    var m = s.mins || 0;
    if(isFocus(s)){
      byDay[s.date] = (byDay[s.date]||0) + m;
      var label = s.label || "General";
      bySubj[label] = (bySubj[label]||0) + m;
    } else breakByDay[s.date] = (breakByDay[s.date]||0) + m;
  });

  var days = [];
  for(var i=6;i>=0;i--){
    var d = new Date(Date.now()-i*86400000);
    days.push({key:dayKey(d), label:["S","M","T","W","T","F","S"][d.getDay()], mins:byDay[dayKey(d)]||0});
  }
  var peak = Math.max(60, Math.max.apply(null, days.map(function(d){ return d.mins; })));
  $("week").innerHTML = days.map(function(d){
    return '<div class="col'+(d.key===t?" today":"")+'"><div class="bar" style="height:'+Math.max(3,(d.mins/peak)*100).toFixed(1)+
      '%" title="'+d.key+' — '+humanMins(d.mins)+'"></div><span class="d">'+d.label+'</span></div>';
  }).join("");

  var keys = Object.keys(bySubj).sort(function(a,b){ return bySubj[b]-bySubj[a]; });
  var maxS = keys.length ? bySubj[keys[0]] : 1;
  $("splits").innerHTML = keys.length ? keys.map(function(k,i){
    return '<div class="split" style="--hue:'+HUES[i % HUES.length]+'"><span class="nm">'+esc(k)+'</span>'+
      '<span class="track"><span class="fill" style="width:'+((bySubj[k]/maxS)*100).toFixed(1)+'%"></span></span>'+
      '<span class="m">'+humanMins(bySubj[k])+'</span></div>';
  }).join("") : '<p class="status">No focus sessions yet.</p>';

  renderHistory(byDay, breakByDay);
}

/* year heatmap + month bars, focus and break kept apart */
var histYear = new Date().getFullYear();
function renderHistory(byDay, breakByDay){
  byDay = byDay || {}; breakByDay = breakByDay || {};
  var years = {};
  state.sessions.forEach(function(s){ if(s.date) years[s.date.slice(0,4)] = 1; });
  years[String(new Date().getFullYear())] = 1;
  var ylist = Object.keys(years).sort();
  if(ylist.indexOf(String(histYear)) < 0) histYear = +ylist[ylist.length-1];
  $("hist-year").innerHTML = ylist.map(function(y){
    return '<button type="button" class="'+(+y === histYear ? "on" : "")+'" data-y="'+y+'">'+y+'</button>';
  }).join("");

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var focusM = new Array(12).fill(0), breakM = new Array(12).fill(0), totF = 0, totB = 0, activeDays = 0;
  Object.keys(byDay).forEach(function(d){
    if(d.slice(0,4) !== String(histYear)) return;
    focusM[+d.slice(5,7)-1] += byDay[d]; totF += byDay[d]; activeDays++;
  });
  Object.keys(breakByDay).forEach(function(d){
    if(d.slice(0,4) !== String(histYear)) return;
    breakM[+d.slice(5,7)-1] += breakByDay[d]; totB += breakByDay[d];
  });

  $("hist-focus").textContent = humanMins(totF);
  $("hist-break").textContent = humanMins(totB);
  $("hist-days").textContent = activeDays;
  $("hist-avg").textContent = activeDays ? humanMins(totF/activeDays) : "0m";

  var maxM = Math.max(60, Math.max.apply(null, focusM.concat(breakM)));
  $("hist-months").innerHTML = MON.map(function(mo,i){
    return '<div class="mcol" title="'+mo+' — '+humanMins(focusM[i])+' focus, '+humanMins(breakM[i])+' break">'+
      '<div class="mstack">'+
        '<div class="mbar brk" style="height:'+(breakM[i]/maxM*100).toFixed(1)+'%"></div>'+
        '<div class="mbar foc" style="height:'+(focusM[i]/maxM*100).toFixed(1)+'%"></div>'+
      '</div><span class="d">'+mo[0]+'</span></div>';
  }).join("");

  /* day grid: one column per week, Sunday at the top */
  var start = new Date(histYear,0,1), end = new Date(histYear,11,31);
  var cells = "", cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  var peak = Math.max.apply(null, Object.keys(byDay).map(function(d){ return byDay[d]; }).concat([60]));
  while(cursor <= end){
    var k = dayKey(cursor), mins = byDay[k] || 0, lvl = 0;
    if(mins > 0) lvl = mins >= peak*.75 ? 4 : mins >= peak*.5 ? 3 : mins >= peak*.25 ? 2 : 1;
    var inYear = cursor.getFullYear() === histYear;
    cells += '<i class="cell l'+lvl+(inYear?"":" off")+'" title="'+k+' — '+humanMins(mins)+'"></i>';
    cursor.setDate(cursor.getDate()+1);
  }
  $("hist-grid").innerHTML = cells;
}
$("trend-scope").addEventListener("change", renderAnalytics);
$("sec-scope").addEventListener("change", renderAnalytics);
$("hist-year").addEventListener("click", function(e){
  var y = e.target.getAttribute("data-y"); if(!y) return;
  histYear = +y; renderStudy();
});

/* backfill a session by hand — for time studied away from this timer */
$("add-session").addEventListener("click", function(){
  var mins = clamp(parseInt($("bf-mins").value,10)||0, 1, 1440);
  if(!mins){ toast("Enter the minutes first"); return; }
  var date = $("bf-date").value || today();
  var subj = subjOf($("bf-subj").value);
  var kind = $("bf-kind").value;
  state.sessions.push({id:uid("ss"), date:date, examId:state.activeExam,
                       key: kind === "break" ? "break" : subj.key,
                       label: kind === "break" ? "Break" : subj.label,
                       kind:kind, mins:mins, at:new Date(date+"T12:00:00").getTime()});
  save(); liveRefresh(); renderStudy(); renderTimer();
  $("bf-mins").value = "";
  toast("Added " + mins + "m on " + date);
});
function timerSubjects(){
  var ex = examOf(state.activeExam);
  var list = ex ? ex.sections.map(function(S){ return {key:S.key, label:S.name, hue:S.hue}; }) : [];
  list.push({key:"general", label:"General", hue:"#83887A"});
  return list;
}
function subjOf(k){
  var list = timerSubjects();
  for(var i=0;i<list.length;i++){ if(list[i].key === k) return list[i]; }
  return list[list.length-1];
}
function modeMins(m){ return m === "focus" ? state.focusLen : (m === "short" ? 5 : 15); }
function modeMs(m){ return modeMins(m)*60000; }
function beep(){
  try{
    var C = window.AudioContext || window.webkitAudioContext; if(!C) return;
    var ctx = new C();
    [0,.22].forEach(function(off,i){
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = i ? 784 : 587;
      g.gain.setValueAtTime(.0001, ctx.currentTime+off);
      g.gain.exponentialRampToValueAtTime(.2, ctx.currentTime+off+.02);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+off+.2);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime+off); o.stop(ctx.currentTime+off+.22);
    });
    setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 900);
  }catch(e){}
}
function completeTimer(silent){
  var wasFocus = timer.mode === "focus";
  var s = subjOf(timer.subj);
  state.sessions.push({id:uid("ss"), date:today(), examId:state.activeExam,
                       key: wasFocus ? timer.subj : "break",
                       label: wasFocus ? s.label : "Break",
                       kind: wasFocus ? "focus" : "break",
                       mins: modeMins(timer.mode), at:Date.now()});
  timer.running = false;
  timer.mode = wasFocus ? "short" : "focus";
  timer.left = modeMs(timer.mode); timer.endsAt = 0;
  document.title = "Project Singularity";
  save(); renderTimer();
  if(!silent){
    beep(); $("dial").classList.add("done");
    setTimeout(function(){ $("dial").classList.remove("done"); }, 2000);
    toast(wasFocus ? "Session done — " + modeMins("focus") + "m on " + subjOf(timer.subj).label : "Break over");
  }
}
function tick(){
  if(!timer.running) return;
  timer.left = timer.endsAt - Date.now();
  if(timer.left <= 0){ completeTimer(false); return; }
  paintDial();
  document.title = mmss(timer.left) + " · " + MODES[timer.mode].label;
}
function paintDial(){
  var total = modeMs(timer.mode);
  var left = timer.running ? Math.max(0, timer.endsAt - Date.now()) : timer.left;
  var frac = total ? clamp(left/total,0,1) : 0;
  $("dial-time").textContent = mmss(left);
  $("dial-label").textContent = MODES[timer.mode].label;
  /* liquid level: full at the top of the blob, draining to empty */
  $("liquid").setAttribute("transform", "translate(0," + (14 + (300-14)*(1-frac)).toFixed(1) + ")");
  var focus = timer.mode === "focus";
  $("wave-a").setAttribute("fill", focus ? "url(#juice)" : "url(#rest)");
  $("wave-b").setAttribute("fill", focus ? "#BE5103" : "#6C71A6");
  $("blob-outline").setAttribute("stroke", focus ? "#BE5103" : "#6C71A6");
  $("start-btn").textContent = timer.running ? "Pause" : (left < total ? "Resume" : "Start");
  $("stop-btn").disabled = (!timer.running && left >= total);
}
var setupFilled = false, setupForced = false;
function renderTimerSetup(){
  var s = $("timer-setup"); if(!s) return;
  var hasExams = state.exams.length > 0;
  var need = !hasExams || setupForced;
  s.hidden = !need;
  $("subjects").hidden = need;
  $("timer-meta").hidden = need;
  if(need && !setupFilled){
    $("setup-preset").innerHTML = Object.keys(PRESETS).filter(function(k){ return k !== "custom"; })
      .map(function(k){ return '<option value="'+k+'">'+esc(PRESETS[k].label)+'</option>'; }).join("");
    setupFilled = true;
  }
  $("setup-title").textContent = hasExams ? "Add another exam" : "Which exam are you preparing for?";
  $("setup-cancel").hidden = !hasExams;
  var wrap = $("setup-signin-wrap");
  if(wrap) wrap.hidden = !(need && syncEnabled && !syncUser);
}
function renderTimer(){
  renderTimerSetup();
  $("modes").innerHTML = Object.keys(MODES).map(function(m){
    return '<button type="button" data-m="'+m+'" class="'+(timer.mode===m?"on":"")+'">'+MODES[m].label+' '+modeMins(m)+'</button>';
  }).join("");
  var subs = timerSubjects();
  if(!subs.some(function(s){ return s.key === timer.subj; })) timer.subj = subs[subs.length-1].key;
  $("subjects").innerHTML = subs.map(function(s){
    return '<button type="button" class="subj'+(timer.subj===s.key?" on":"")+'" data-k="'+s.key+'" style="--hue:'+s.hue+'"><i></i>'+esc(s.label)+'</button>';
  }).join("");
  $("flen").value = state.focusLen;
  paintDial();
  var t = today(), tm = 0, tc = 0, wm = 0, byDay = {};
  var wk = Date.now() - 6*86400000;
  var br = 0;
  state.sessions.forEach(function(s){
    if(!isFocus(s)){ if(s.date === t) br += s.mins||0; return; }
    byDay[s.date] = (byDay[s.date]||0) + (s.mins||0);
    if(s.date === t){ tm += s.mins||0; tc++; }
    if(s.at >= wk) wm += s.mins||0;
  });
  $("f-break").textContent = humanMins(br);
  $("f-today").textContent = humanMins(tm);
  $("f-sessions").textContent = tc;
  $("f-week").textContent = humanMins(wm);
  var streak = 0, cur = new Date();
  if(!byDay[dayKey(cur)]) cur = new Date(Date.now()-86400000);
  while(byDay[dayKey(cur)]){ streak++; cur = new Date(cur.getTime()-86400000); }
  $("f-streak").textContent = streak;
}
$("modes").addEventListener("click", function(e){
  var m = e.target.getAttribute("data-m"); if(!m) return;
  timer.mode = m; timer.running = false; timer.endsAt = 0; timer.left = modeMs(m);
  document.title = "Project Singularity"; save(); renderTimer();
});
$("subjects").addEventListener("click", function(e){
  var b = e.target.closest(".subj"); if(!b) return;
  timer.subj = b.getAttribute("data-k"); save(); renderTimer();
});
$("setup-go").addEventListener("click", function(){
  var k = $("setup-preset").value, p = PRESETS[k]; if(!p) return;
  var ex = makeExam(p.label, k);
  state.exams.push(ex); state.activeExam = ex.id;
  setupForced = false;
  save(); refreshSelectors(); renderTimer(); renderExams(); buildNotifs();
  toast("Set up " + p.label);
});
$("setup-custom").addEventListener("click", function(){ setupForced = false; showTab("mocks"); openNewExam(true); });
$("setup-cancel").addEventListener("click", function(){ setupForced = false; renderTimer(); });
$("setup-signin").addEventListener("click", function(){ if($("acct")) $("acct").click(); else showTab("data"); });
$("add-exam-btn").addEventListener("click", function(){ setupForced = true; renderTimer(); });
$("start-btn").addEventListener("click", function(){
  if(timer.running){
    timer.left = Math.max(0, timer.endsAt - Date.now()); timer.running = false;
    document.title = "Project Singularity";
  } else {
    if(timer.left <= 0) timer.left = modeMs(timer.mode);
    timer.endsAt = Date.now() + timer.left; timer.running = true;
  }
  save(); renderTimer();
});
$("stop-btn").addEventListener("click", function(){
  var total = modeMs(timer.mode);
  var left = timer.running ? Math.max(0, timer.endsAt - Date.now()) : timer.left;
  var spent = Math.round((total - left)/60000);
  if(timer.mode === "focus" && spent >= 1){
    var s = subjOf(timer.subj);
    state.sessions.push({id:uid("ss"), date:today(), examId:state.activeExam, key:timer.subj,
                         label:s.label, kind:"focus", mins:spent, at:Date.now()});
    toast("Stopped — banked " + spent + "m on " + s.label);
  } else toast("Stopped");
  timer.running = false; timer.endsAt = 0; timer.left = modeMs(timer.mode);
  document.title = "Project Singularity"; save(); renderTimer();
});
$("reset-btn").addEventListener("click", function(){
  timer.running = false; timer.endsAt = 0; timer.left = modeMs(timer.mode);
  document.title = "Project Singularity"; save(); renderTimer();
});
$("flen").addEventListener("change", function(){
  state.focusLen = clamp(parseInt($("flen").value,10)||25, 5, 180);
  $("flen").value = state.focusLen;
  if(timer.mode === "focus" && !timer.running){ timer.left = modeMs("focus"); timer.endsAt = 0; }
  save(); renderTimer();
});
$("timer-exam").addEventListener("change", function(){
  state.activeExam = $("timer-exam").value; save(); renderTimer();
});
document.addEventListener("keydown", function(e){
  if(e.code !== "Space" || !$("p-timer").classList.contains("on")) return;
  if(e.target.matches("input,textarea,select,button")) return;
  e.preventDefault(); $("start-btn").click();
});
function waterState(){
  if(!state.water || state.water.date !== today()) state.water = {date:today(), n:0, goal:8};
  return state.water;
}
function renderWater(){
  var w = waterState();
  $("water").classList.toggle("mini", !!state.waterMin);
  $("water-label").textContent = w.n + " of " + w.goal + " glasses";
  $("mini-count").textContent = w.n;
  /* the small glass fills to the same proportion as the day */
  $("mini-fill").style.transform = "translateY(" + (26 * (1 - w.n/w.goal)).toFixed(1) + "px)";
  var out = "";
  for(var i=0;i<w.goal;i++){
    out += '<button type="button" class="glass'+(i < w.n ? " on" : "")+'" data-g="'+(i+1)+'" aria-label="Glass '+(i+1)+'">'+
      '<svg viewBox="0 0 24 30"><path class="cup" d="M4 3h16l-2 24H6L4 3z"/>'+
      '<clipPath id="cl'+i+'"><path d="M4 3h16l-2 24H6L4 3z"/></clipPath>'+
      '<g clip-path="url(#cl'+i+')"><rect class="fill" x="2" y="6" width="20" height="24"/></g></svg></button>';
  }
  $("glasses").innerHTML = out;
}
$("glasses").addEventListener("click", function(e){
  var b = e.target.closest(".glass"); if(!b) return;
  var w = waterState(), n = +b.getAttribute("data-g");
  w.n = (w.n === n) ? n-1 : n;
  save(); renderWater();
  if(w.n === w.goal) toast("That is the day's water done");
});
$("water-mini").addEventListener("click", function(){ state.waterMin = false; save(); renderWater(); });
$("water-hide").addEventListener("click", function(){ state.waterMin = true; save(); renderWater(); });
$("water-undo").addEventListener("click", function(){
  var w = waterState(); w.n = Math.max(0, w.n-1); save(); renderWater();
});
function videoId(url){
  var s = String(url||"").trim();
  /* study-with-me streams are usually /live/ links, so that form has to work too */
  var m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  if(m) return m[1];
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}
function renderVideos(){
  var host = $("vidgrid");
  if(!state.videos.length){
    host.innerHTML = '<div class="card empty"><h3>Nothing saved</h3><p>Paste a YouTube link above to keep it here.</p></div>';
    return;
  }
  host.innerHTML = state.videos.map(function(v){
    return '<div class="vidcard" data-vid="'+v.id+'">'+
      '<div class="thumb"><img loading="lazy" src="https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg" alt="">'+
        '<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>'+
      '<div class="vidmeta"><b>'+esc(v.t||"Video")+'</b><span>'+esc(v.s||"YouTube")+
      ' · <a href="https://www.youtube.com/watch?v='+v.id+'" target="_blank" rel="noopener">open on YouTube</a></span></div>'+
      '<button class="del" type="button" data-vdel="'+v.id+'" aria-label="Remove">×</button></div>';
  }).join("");
}
$("vidgrid").addEventListener("click", function(e){
  var del = e.target.getAttribute("data-vdel");
  if(del){ state.videos = state.videos.filter(function(v){ return v.id !== del; }); save(); renderVideos(); return; }
  var card = e.target.closest("[data-vid]"); if(!card) return;
  var id = card.getAttribute("data-vid");
  if(card.querySelector("iframe")) return;
  card.querySelector(".thumb").innerHTML =
    '<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0" title="video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
});
$("vid-add").addEventListener("click", function(){
  var id = videoId($("vid-url").value);
  if(!id){ toast("That is not a YouTube link"); return; }
  if(state.videos.some(function(v){ return v.id === id; })){ toast("Already saved"); return; }
  state.videos.unshift({id:id, t:$("vid-name").value.trim() || "Saved video", s:"Added by you"});
  $("vid-url").value = ""; $("vid-name").value = "";
  save(); renderVideos(); toast("Saved");
});
var actx = null, ambNode = null, ambGain = null, ambKind = null;
var AMB = [
  {k:"rain",  label:"Rain"},
  {k:"ocean", label:"Ocean"},
  {k:"fire",  label:"Fire"},
  {k:"wind",  label:"Wind"},
  {k:"cafe",  label:"Cafe"},
  {k:"deep",  label:"Deep"}
];
var ambParts = [], crackleTimer = null;
function noiseBuffer(ctx, brownness){
  var len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  var last = 0, b = brownness === undefined ? 0.02 : brownness;
  for(var i=0;i<len;i++){
    var white = Math.random()*2-1;
    last = (last + b*white)/(1+b);
    d[i] = last * (3.2/Math.sqrt(b/0.02));
  }
  return buf;
}
function layer(brownness, type, freq, q, gain){
  var src = actx.createBufferSource();
  src.buffer = noiseBuffer(actx, brownness); src.loop = true;
  var f = actx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  var g = actx.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(ambGain);
  src.start();
  ambParts.push(src);
  return {src:src, filter:f, gain:g};
}
function lfo(rate, depth, target){
  var o = actx.createOscillator(), g = actx.createGain();
  o.frequency.value = rate; g.gain.value = depth;
  o.connect(g); g.connect(target); o.start();
  ambParts.push(o);
}
function stopAmb(){
  ambParts.forEach(function(n){ try{ n.stop(); }catch(e){} });
  ambParts = [];
  if(crackleTimer){ clearInterval(crackleTimer); crackleTimer = null; }
  ambKind = null;
  renderAmb();
}
function playAmb(kind){
  if(!actx){ var C = window.AudioContext || window.webkitAudioContext;
    if(!C){ toast("No audio support here"); return; } actx = new C(); }
  if(actx.state === "suspended") actx.resume();
  stopAmb();
  ambGain = actx.createGain();
  ambGain.gain.value = (+$("amb-vol").value || 45)/100 * .45;
  ambGain.connect(actx.destination);

  if(kind === "rain"){
    layer(0.06, "bandpass", 1100, 0.6, 0.9);            /* body of the rain */
    layer(0.5,  "highpass", 4200, 0.4, 0.16);           /* fine hiss on top */
    var patter = layer(0.2, "bandpass", 2400, 1.4, 0.3);
    lfo(0.23, 700, patter.filter.frequency);            /* gusts moving through */
  } else if(kind === "ocean"){
    var surf = layer(0.02, "lowpass", 480, 0.5, 1.0);
    lfo(0.055, 260, surf.filter.frequency);             /* the swell */
    lfo(0.055, 0.42, surf.gain.gain);                   /* waves rising and falling */
    layer(0.35, "highpass", 3000, 0.4, 0.07);           /* foam */
  } else if(kind === "fire"){
    layer(0.015, "lowpass", 380, 0.5, 0.75);            /* the low roar */
    var hiss = layer(0.3, "bandpass", 1800, 0.9, 0.12);
    crackleTimer = setInterval(function(){              /* irregular pops */
      if(!actx || !ambGain) return;
      var t = actx.currentTime, g = hiss.gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.5 + Math.random()*0.4, t + 0.012);
      g.exponentialRampToValueAtTime(0.12, t + 0.09 + Math.random()*0.12);
    }, 190 + Math.random()*260);
  } else if(kind === "wind"){
    var w = layer(0.04, "bandpass", 620, 1.1, 0.95);
    lfo(0.07, 420, w.filter.frequency);
    lfo(0.11, 0.35, w.gain.gain);
    layer(0.02, "lowpass", 200, 0.4, 0.35);
  } else if(kind === "cafe"){
    layer(0.01, "lowpass", 300, 0.4, 0.8);              /* room rumble */
    var murmur = layer(0.09, "bandpass", 700, 0.8, 0.4);/* voices, blurred */
    lfo(0.13, 180, murmur.filter.frequency);
    layer(0.4, "highpass", 5000, 0.3, 0.05);            /* cups and cutlery */
  } else {
    layer(0.008, "lowpass", 180, 0.4, 1.0);             /* deep hush */
    layer(0.02, "lowpass", 90, 0.6, 0.5);
  }
  ambKind = kind;
  renderAmb();
}
function renderAmb(){
  $("amb").innerHTML = AMB.map(function(a){
    return '<button type="button" class="ambbtn'+(ambKind===a.k?" on":"")+'" data-amb="'+a.k+'">'+a.label+'</button>';
  }).join("");
}
$("amb").addEventListener("click", function(e){
  var k = e.target.getAttribute("data-amb"); if(!k) return;
  if(ambKind === k) stopAmb(); else playAmb(k);
});
$("amb-vol").addEventListener("input", function(){
  if(ambGain) ambGain.gain.value = (+$("amb-vol").value)/100 * .45;
});
$("dock-toggle").addEventListener("click", function(){
  var b = $("dock-body");
  b.hidden = !b.hidden;
  $("dock").classList.toggle("open", !b.hidden);
});
$("dock-go").addEventListener("click", function(){
  var u = $("dock-url").value.trim();
  var sp = u.match(/open\.spotify\.com\/(playlist|album|track|episode|show)\/([A-Za-z0-9]+)/);
  var yt = u.match(/[?&]list=([A-Za-z0-9_-]+)/) || (videoId(u) ? [null, null] : null);
  if(sp){
    $("dock-embed").innerHTML = '<iframe style="border-radius:14px" src="https://open.spotify.com/embed/'+sp[1]+'/'+sp[2]+
      '?utm_source=generator" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" loading="lazy"></iframe>';
    state.dockUrl = u; save();
  } else if(u.match(/[?&]list=([A-Za-z0-9_-]+)/)){
    var pid = u.match(/[?&]list=([A-Za-z0-9_-]+)/)[1];
    $("dock-embed").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/videoseries?list='+pid+
      '" width="100%" height="150" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" style="border-radius:14px"></iframe>';
    state.dockUrl = u; save();
  } else if(videoId(u)){
    $("dock-embed").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/'+videoId(u)+
      '?rel=0" width="100%" height="150" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" style="border-radius:14px"></iframe>';
    state.dockUrl = u; save();
  } else { toast("Paste a Spotify or YouTube link"); return; }
  $("dock-embed").insertAdjacentHTML("beforeend",
    '<a class="dock-out" href="'+esc(u)+'" target="_blank" rel="noopener">Not playing? Open it directly</a>');
});

/* re-render whatever panel is on screen after data changes */
function liveRefresh(){
  var on = document.querySelector(".panel.on");
  if(!on) return;
  if(on.id === "p-analytics") renderAnalytics();
  else if(on.id === "p-timer") renderTimer();
  else if(on.id === "p-mocks") renderExams();
}
var STAGES = [
  {k:"applied",  label:"Applied",           tone:"blue"},
  {k:"admit",    label:"Admit card awaited", tone:"amber"},
  {k:"scheduled",label:"Exam scheduled",     tone:"amber"},
  {k:"done",     label:"Exam done",          tone:"blue"},
  {k:"result",   label:"Result awaited",     tone:"amber"},
  {k:"out",      label:"Result out",         tone:"green"},
  {k:"next",     label:"Cleared, next stage",tone:"green"},
  {k:"no",       label:"Not cleared",        tone:"red"}
];
function stageOf(k){ for(var i=0;i<STAGES.length;i++){ if(STAGES[i].k===k) return STAGES[i]; } return STAGES[0]; }
function daysTo(d){
  if(!d) return null;
  return Math.round((new Date(d+"T00:00:00") - new Date(today()+"T00:00:00"))/86400000);
}
function renderApps(){
  $("ap-stage").innerHTML = STAGES.map(function(s){ return '<option value="'+s.k+'">'+s.label+'</option>'; }).join("");
  var list = $("apps-list");
  $("apps-count").textContent = state.apps.length ? state.apps.length + " tracked" : "";
  if(!state.apps.length){
    list.innerHTML = '<div class="card empty"><h3>Nothing tracked yet</h3><p>Add every exam you have applied for, and keep its stage up to date as things move.</p></div>';
    return;
  }
  var order = STAGES.map(function(s){ return s.k; });
  var sorted = state.apps.slice().sort(function(a,b){
    var ad = daysTo(a.examOn), bd = daysTo(b.examOn);
    if(ad !== null && bd !== null && ad !== bd) return ad - bd;
    if(ad !== null && bd === null) return -1;
    if(bd !== null && ad === null) return 1;
    return order.indexOf(a.stage) - order.indexOf(b.stage);
  });
  list.innerHTML = sorted.map(function(a){
    var st = stageOf(a.stage), dt = daysTo(a.examOn);
    var when = dt === null ? "no date set"
      : dt === 0 ? "exam is today"
      : dt > 0 ? "in " + dt + " day" + (dt===1?"":"s")
      : Math.abs(dt) + " day" + (dt===-1?"":"s") + " ago";
    return '<div class="card appcard" data-id="'+a.id+'">'+
      '<div class="apphead"><b>'+esc(a.name)+'</b>'+
        '<span class="badge '+st.tone+'">'+st.label+'</span>'+
        '<button class="del" type="button" data-del="'+a.id+'" aria-label="Remove">×</button></div>'+
      '<div class="approw">'+
        '<label>Stage<select data-f="stage">'+STAGES.map(function(s){
          return '<option value="'+s.k+'"'+(s.k===a.stage?" selected":"")+'>'+s.label+'</option>'; }).join("")+'</select></label>'+
        '<label>Exam date<input type="date" data-f="examOn" value="'+(a.examOn||"")+'"></label>'+
        '<label>Result date<input type="date" data-f="resultOn" value="'+(a.resultOn||"")+'"></label>'+
        '<label>Marks / result<input type="text" data-f="marks" placeholder="e.g. 148.5 or 96.5 %ile" value="'+esc(a.marks||"")+'"></label>'+
      '</div>'+
      '<div class="approw wide"><label>Notes<input type="text" data-f="notes" placeholder="Roll no, centre, what is pending" value="'+esc(a.notes||"")+'"></label></div>'+
      '<div class="appfoot">'+esc(when)+(a.resultOn ? ' · result ' + a.resultOn : '')+'</div>'+
    '</div>';
  }).join("");
}
$("ap-add").addEventListener("click", function(){
  var name = $("ap-name").value.trim();
  if(!name){ toast("Name the exam first"); return; }
  state.apps.push({id:uid("ap"), name:name, stage:$("ap-stage").value,
                   examOn:$("ap-exam").value || "", resultOn:"", marks:"", notes:""});
  $("ap-name").value = ""; $("ap-exam").value = "";
  save(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
  if(state.dockUrl){ $("dock-url").value = state.dockUrl; } toast("Added " + name);
});
$("apps-list").addEventListener("click", function(e){
  var id = e.target.getAttribute("data-del"); if(!id) return;
  state.apps = state.apps.filter(function(a){ return a.id !== id; });
  save(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
  if(state.dockUrl){ $("dock-url").value = state.dockUrl; }
});
$("apps-list").addEventListener("change", function(e){
  var f = e.target.getAttribute("data-f"); if(!f) return;
  var card = e.target.closest("[data-id]"), id = card.getAttribute("data-id");
  state.apps.forEach(function(a){ if(a.id === id) a[f] = e.target.value; });
  save(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
  if(state.dockUrl){ $("dock-url").value = state.dockUrl; }
});
function buildNotifs(){
  var out = [];
  state.apps.forEach(function(a){
    var d = daysTo(a.examOn);
    if(d !== null && d >= 0 && d <= 21 && a.stage !== "done" && a.stage !== "out")
      out.push({t:"Exam soon", b: a.name + (d === 0 ? " is today" : " in " + d + " day" + (d===1?"":"s")), tone:"amber"});
    if(a.stage === "admit" && d !== null && d <= 14 && d >= 0)
      out.push({t:"Admit card", b:"Still awaited for " + a.name, tone:"amber"});
    var r = daysTo(a.resultOn);
    if(a.stage === "result" && r !== null && r <= 0)
      out.push({t:"Result due", b: a.name + " result date has passed — check it", tone:"blue"});
  });
  var last = state.mocks.filter(function(m){ return m.date; }).map(function(m){ return m.date; }).sort().pop();
  if(last){
    var gap = -daysTo(last);
    if(gap >= 7) out.push({t:"No mock logged", b:"Last one was " + gap + " days ago", tone:"blue"});
  }
  var t = today(), todayMins = 0;
  state.sessions.forEach(function(s){ if(s.date === t && isFocus(s)) todayMins += s.mins||0; });
  if(todayMins === 0) out.push({t:"No focus yet today", b:"Start a session from the Timer tab", tone:"blue"});

  $("bell-dot").hidden = !out.length;
  $("notif").innerHTML = out.length
    ? '<div class="notif-head">Notifications</div>' + out.map(function(n){
        return '<div class="notif-item '+n.tone+'"><b>'+esc(n.t)+'</b><span>'+esc(n.b)+'</span></div>'; }).join("")
    : '<div class="notif-head">Notifications</div><div class="notif-item"><span>Nothing needs attention.</span></div>';
}
$("bell").addEventListener("click", function(e){
  e.stopPropagation();
  buildNotifs();
  $("notif").hidden = !$("notif").hidden;
});
document.addEventListener("click", function(e){
  if(!$("notif").hidden && !$("notif").contains(e.target)) $("notif").hidden = true;
});
var noteDirty = false;

function currentNote(){
  for(var i=0;i<state.notes.length;i++){ if(state.notes[i].id === state.activeNote) return state.notes[i]; }
  return null;
}
function renderNoteList(){
  var list = $("note-list");
  if(!state.notes.length){
    list.innerHTML = '<div class="empty" style="padding:22px 14px"><p>No notes yet.</p></div>';
    return;
  }
  list.innerHTML = state.notes.map(function(n){
    return '<div class="note-item'+(n.id === state.activeNote ? " on" : "")+'" data-id="'+n.id+'">'+
      '<b>'+esc(n.title || "Untitled")+'</b><span>'+new Date(n.updatedAt).toLocaleDateString()+'</span></div>';
  }).join("");
}
function renderNotes(){
  renderNoteList();
  var note = currentNote();
  $("note-edit").hidden = !note;
  $("note-blank").hidden = !!note;
  if(!note) return;
  if(document.activeElement !== $("note-title") && document.activeElement !== $("note-body")){
    $("note-title").value = note.title;
    $("note-body").value = note.body;
  }
  $("save-note").disabled = !noteDirty;
  $("note-saved").textContent = noteDirty ? "Unsaved changes" : "Saved " + new Date(note.updatedAt).toLocaleString();
  $("note-saved").classList.toggle("dirty", noteDirty);
}
function commitNote(quiet){
  var note = currentNote();
  if(!note || !noteDirty) return false;
  note.title = $("note-title").value;
  note.body = $("note-body").value;
  note.updatedAt = Date.now();
  noteDirty = false;
  save();
  if(!quiet) toast("Note saved");
  renderNotes();
  return true;
}
function markDirty(){
  if(noteDirty) return;
  noteDirty = true;
  $("save-note").disabled = false;
  $("note-saved").textContent = "Unsaved changes";
  $("note-saved").classList.add("dirty");
}
function newNote(){
  commitNote(true);
  var n = {id:uid("nt"), title:"", body:"", updatedAt:Date.now()};
  state.notes.unshift(n);
  state.activeNote = n.id; noteDirty = false;
  save(); renderNotes(); $("note-title").focus();
}
$("note-list").addEventListener("click", function(e){
  var it = e.target.closest(".note-item"); if(!it) return;
  commitNote(true);
  state.activeNote = it.getAttribute("data-id"); noteDirty = false;
  renderNotes();
});
$("new-note").addEventListener("click", newNote);
$("blank-new").addEventListener("click", newNote);
$("save-note").addEventListener("click", function(){ commitNote(false); });
$("close-note").addEventListener("click", function(){
  commitNote(true);
  state.activeNote = null; noteDirty = false;
  renderNotes();
});
$("del-note").addEventListener("click", function(){
  if(!state.activeNote) return;
  state.notes = state.notes.filter(function(n){ return n.id !== state.activeNote; });
  state.activeNote = null; noteDirty = false;
  save(); renderNotes(); toast("Note deleted");
});
$("note-title").addEventListener("input", markDirty);
$("note-body").addEventListener("input", markDirty);
/* autosave only when the note leaves the screen */
document.addEventListener("visibilitychange", function(){ if(document.hidden) commitNote(true); });
window.addEventListener("beforeunload", function(){ commitNote(true); });
function refreshSelectors(){
  var subs = timerSubjects();
  $("bf-subj").innerHTML = subs.map(function(s){ return '<option value="'+s.key+'">'+esc(s.label)+'</option>'; }).join("");
  if(!$("bf-date").value) $("bf-date").value = today();
  var opts = state.exams.map(function(e){ return '<option value="'+e.id+'">'+esc(e.name)+'</option>'; }).join("");
  ["timer-exam","an-exam"].forEach(function(id){
    var cur = $(id).value;
    $(id).innerHTML = opts;
    var want = (id === "timer-exam") ? state.activeExam : (cur || state.activeExam);
    if(want) $(id).value = want;
  });
}
function download(name, text, type){
  var b = new Blob([text], {type:type}), u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(u); }, 1000);
}
function cell(v){ var s = String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
$("csv-btn").addEventListener("click", function(){
  if(!state.mocks.length){ toast("Nothing to export"); return; }
  var rows = [["Exam","Mock","Date","Type","Section","Correct","Wrong","Marks","Section total"]];
  state.mocks.forEach(function(m){
    var ex = examOf(m.examId); if(!ex) return;
    ex.sections.forEach(function(S){
      var v = m.sections[S.key]; if(!v) return;
      rows.push([ex.name, m.name, m.date || "", m.type, S.name,
                 v.m != null ? "" : v.c, v.m != null ? "" : v.w,
                 fmt(v.m != null ? v.m : v.c*ex.correct - v.w*ex.penalty), S.q*ex.correct]);
    });
  });
  download("mocks.csv", rows.map(function(r){ return r.map(cell).join(","); }).join("\n"), "text/csv;charset=utf-8");
});
$("study-csv-btn").addEventListener("click", function(){
  if(!state.sessions.length){ toast("No sessions yet"); return; }
  var rows = [["Date","Subject","Minutes","Finished at"]];
  state.sessions.slice().sort(function(a,b){ return a.at-b.at; }).forEach(function(s){
    rows.push([s.date, s.label || "General", s.mins, new Date(s.at).toLocaleTimeString()]);
  });
  download("study-time.csv", rows.map(function(r){ return r.map(cell).join(","); }).join("\n"), "text/csv;charset=utf-8");
});
$("export-btn").addEventListener("click", function(){ download("project-singularity-backup.json", JSON.stringify(snapshot(), null, 2), "application/json"); });
$("reset-all").addEventListener("click", function(){
  if(!confirm("Start fresh? This erases all exams, mocks, study sessions, notes and settings on THIS device. If you're signed in, your cloud copy is untouched. This can't be undone.")) return;
  try{ if(db) db.transaction("kv","readwrite").objectStore("kv").delete("state"); }catch(e){}
  try{ localStorage.removeItem("singularity." + STORE); }catch(e){}
  try{ localStorage.removeItem(SYNC_META); }catch(e){}
  location.reload();
});
$("import-btn").addEventListener("click", function(){ $("import-file").click(); });
$("import-file").addEventListener("change", function(e){
  var f = e.target.files && e.target.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(){
    try{
      var d = JSON.parse(r.result);
      if(!d || !Array.isArray(d.exams)) throw new Error("bad");
      applyStored(d); save(); refreshSelectors(); renderExams(); renderTimer(); renderNotes();
      toast("Restored "+state.exams.length+" exams, "+state.mocks.length+" mocks");
    }catch(err){ toast("That isn't a Project Singularity backup"); }
    e.target.value = "";
  };
  r.readAsText(f);
});
/* ---- cross-device sync (Backup tab) — manual push/pull, no auto-sync ---- */
var SYNC_META = "singularity.sync." + STORE;   /* {at: when this device last synced, remoteAt: the cloud updated_at we last saw} */
function syncMeta(){ try{ return JSON.parse(localStorage.getItem(SYNC_META)) || {}; }catch(e){ return {}; } }
function setSyncMeta(m){ try{ localStorage.setItem(SYNC_META, JSON.stringify(m)); }catch(e){} }
function relTime(iso){
  if(!iso) return "never";
  var t = new Date(iso).getTime(); if(!isFinite(t)) return "never";
  var s = Math.round((Date.now()-t)/1000);
  if(s < 45) return "just now";
  if(s < 3600) return Math.max(1,Math.floor(s/60)) + " min ago";
  if(s < 86400) return Math.floor(s/3600) + "h ago";
  return new Date(iso).toLocaleString();
}
var syncUser = null, syncBusy = false;
function syncMsg(text, isErr){
  var el = $("sync-msg"); if(!el) return;
  el.hidden = !text; el.textContent = text || "";
  el.classList.toggle("err", !!isErr);
}
function updateAcct(){
  var b = $("acct"); if(!b) return;
  b.hidden = !syncEnabled;
  if(!syncEnabled) return;
  var signedIn = !!syncUser;
  b.classList.toggle("in", signedIn);
  var who = signedIn ? ("Synced — " + (syncUser.email || "signed in")) : "Sign in to sync across devices";
  b.setAttribute("aria-label", who); b.setAttribute("title", who);
  var dot = $("acct-dot"); if(dot) dot.hidden = signedIn;   /* nudge dot only while signed out */
}
function renderSync(){
  updateAcct();
  if(!$("sync-card")) return;
  if(!syncEnabled){
    $("sync-off").hidden = false; $("sync-auth").hidden = true; $("sync-panel").hidden = true;
    return;
  }
  $("sync-off").hidden = true;
  var signedIn = !!syncUser;
  $("sync-auth").hidden = signedIn;
  $("sync-panel").hidden = !signedIn;
  if(signedIn){
    $("sync-who").textContent = "Signed in as " + (syncUser.email || "your account");
    $("sync-last").textContent = "Auto-saving to your account · last synced " + relTime(syncMeta().at);
  }
}
function refreshSyncUser(){
  if(!syncEnabled){ renderSync(); return; }
  currentUser().then(function(u){
    var was = !!syncUser;
    syncUser = u; renderSync();
    if(u && !was) autoSyncOnSignin();      /* just signed in (or a saved session loaded) */
    if(!u) autoSyncReady = false;
  }).catch(function(){ syncUser = null; autoSyncReady = false; renderSync(); });
}
/* ---- auto-save to the cloud once signed in: pull first, then push on every change ---- */
var autoSyncReady = false, autoPushTimer = null;
function autoSyncOnSignin(){
  if(!syncEnabled || !syncUser) return;
  syncPull().then(function(res){
    if(res.ok && res.payload){
      /* adopt the account's data; pull-before-push means a blank device never clobbers the cloud */
      applyStored(res.payload);
      setSyncMeta({ at: new Date().toISOString(), remoteAt: res.updatedAt || "" });
      save();                              /* persist locally; autoPush is skipped, ready still false */
      refreshSelectors(); renderTimer(); renderExams(); renderNotes(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
      if(state.dockUrl){ $("dock-url").value = state.dockUrl; }
      renderSync();
      autoSyncReady = true;
      toast("Loaded your saved data");
    } else if(res.ok){
      autoSyncReady = true; autoPush();    /* cloud empty — upload what's on this device */
    } else {
      autoSyncReady = true;                /* pull failed (offline); allow pushes to retry later */
    }
  }).catch(function(){ autoSyncReady = true; });
}
function autoPush(){
  if(!syncEnabled || !syncUser || !autoSyncReady) return;
  clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(function(){
    var now = new Date().toISOString();
    syncPush(snapshot()).then(function(res){
      if(res && res.ok){ setSyncMeta({ at: now, remoteAt: now }); renderSync(); }
    }).catch(function(){});
  }, 1500);
}
if(syncEnabled){
  var doAuth = function(fn, verb){
    var email = ($("sync-email").value || "").trim();
    var pass = $("sync-pass").value || "";
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast("Enter a valid email"); return; }
    if(pass.length < 6){ toast("Password must be at least 6 characters"); return; }
    $("sync-signin").disabled = true; $("sync-signup").disabled = true; syncMsg(verb + "…");
    fn(email, pass).then(function(){ return currentUser(); }).then(function(u){
      if(u){
        syncUser = u; $("sync-pass").value = ""; renderSync(); syncMsg("");
        toast("Signed in"); autoSyncOnSignin();
      } else {
        /* only happens if email confirmation is still on in Supabase */
        syncMsg("Account created. Confirm it from your email, then sign in — or turn off email confirmation in Supabase.", false);
      }
    }).catch(function(e){ syncMsg((e && e.message) || String(e), true); })
      .then(function(){ $("sync-signin").disabled = false; $("sync-signup").disabled = false; });
  };
  $("sync-signin").addEventListener("click", function(){ doAuth(signIn, "Signing in"); });
  $("sync-signup").addEventListener("click", function(){ doAuth(signUp, "Creating account"); });
  $("sync-show").addEventListener("click", function(){
    var p = $("sync-pass"), showing = p.type === "text";
    p.type = showing ? "password" : "text";
    this.textContent = showing ? "Show" : "Hide";
  });
  ["sync-email","sync-pass"].forEach(function(id){
    $(id).addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); $("sync-signin").click(); } });
  });
  $("sync-out").addEventListener("click", function(){
    signOut().then(function(){}).catch(function(){}).then(function(){
      syncUser = null; renderSync(); syncMsg("Signed out on this device.");
    });
  });
  $("sync-push").addEventListener("click", function(){
    if(syncBusy) return; syncBusy = true; syncMsg("Pushing…");
    var m = syncMeta();
    /* conflict guard: did the cloud copy change on another device since we last saw it? */
    syncPull().then(function(remote){
      if(remote.ok && remote.updatedAt && m.remoteAt && remote.updatedAt !== m.remoteAt){
        if(!confirm("The cloud copy changed elsewhere (" + relTime(remote.updatedAt) + "). Overwrite it with this device's data?")){
          syncMsg("Push cancelled — Pull first if you want the other device's changes."); syncBusy = false; return null;
        }
      }
      return syncPush(snapshot());
    }).then(function(res){
      if(res === null) return;               /* cancelled above */
      if(!res.ok){ syncMsg("Push failed: " + res.reason, true); syncBusy = false; return; }
      syncPull().then(function(after){        /* read back the authoritative timestamp */
        var now = new Date().toISOString();
        setSyncMeta({ at: now, remoteAt: (after.ok && after.updatedAt) ? after.updatedAt : now });
        renderSync(); syncMsg("Pushed. The cloud now matches this device."); syncBusy = false;
      });
    }).catch(function(e){ syncMsg("Push failed: " + (e && e.message || e), true); syncBusy = false; });
  });
  $("sync-pull").addEventListener("click", function(){
    if(syncBusy) return; syncBusy = true; syncMsg("Pulling…");
    syncPull().then(function(res){
      if(!res.ok){ syncMsg("Pull failed: " + res.reason, true); syncBusy = false; return; }
      if(!res.payload){ syncMsg("Nothing in the cloud yet — Push from a device that has your data first."); syncBusy = false; return; }
      if(!confirm("Replace this device's data with the cloud copy from " + relTime(res.updatedAt) + "? Local changes on this device will be overwritten.")){
        syncMsg("Pull cancelled."); syncBusy = false; return;
      }
      applyStored(res.payload); save();
      setSyncMeta({ at: new Date().toISOString(), remoteAt: res.updatedAt || "" });
      refreshSelectors(); renderTimer(); renderExams(); renderNotes(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
      if(state.dockUrl){ $("dock-url").value = state.dockUrl; }
      renderSync(); syncMsg("Pulled the cloud copy onto this device."); syncBusy = false;
    }).catch(function(e){ syncMsg("Pull failed: " + (e && e.message || e), true); syncBusy = false; });
  });
}
$("acct").addEventListener("click", function(){
  showTab("data");
  var card = $("sync-card");
  if(card) card.scrollIntoView({behavior:"smooth", block:"center"});
  if(!syncUser){ var em = $("sync-email"); if(em) setTimeout(function(){ em.focus(); }, 320); }
});
/* ---- exam-notification feed (Exams applied tab) ---- */
/* Reads cached postings from our own Cloudflare Worker; the browser can't fetch
   the source site directly (CORS), so the Worker fetches the RSS server-side. */
var FEED_URL = (import.meta.env.VITE_FEED_URL || "").trim();
var feedEnabled = !!FEED_URL;
var feedCache = null, feedFetchedAt = 0;
function feedItemHTML(it){
  var d = it.date ? new Date(it.date) : null;
  var when = d && isFinite(d.getTime()) ? d.toLocaleDateString() : "";
  return '<a class="feed-item" href="'+esc(it.link||"#")+'" target="_blank" rel="noopener">'+
    '<b>'+esc(it.title||"Untitled")+'</b>'+
    '<span>'+esc(it.source||"SarkariResult")+(when ? ' · '+esc(when) : '')+'</span></a>';
}
function paintFeed(items){
  if(!$("feed-list")) return;
  if(!items.length){ $("feed-list").innerHTML = '<p class="status">Nothing new right now.</p>'; $("feed-meta").innerHTML = "&nbsp;"; return; }
  $("feed-list").innerHTML = items.slice(0,20).map(feedItemHTML).join("");
  $("feed-meta").textContent = items.length + " latest";
}
function renderFeed(force){
  if(!$("feed-card")) return;
  if(!feedEnabled){ $("feed-off").hidden = false; $("feed-list").innerHTML = ""; $("feed-meta").innerHTML = "&nbsp;"; return; }
  $("feed-off").hidden = true;
  if(feedCache) paintFeed(feedCache);
  if(feedCache && (Date.now() - feedFetchedAt < 5*60000) && !force) return;   /* 5-min throttle */
  $("feed-meta").textContent = "Refreshing…";
  fetch(FEED_URL, {headers:{accept:"application/json"}})
    .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error("HTTP "+r.status)); })
    .then(function(data){
      var items = Array.isArray(data) ? data : (data && data.items) || [];
      feedCache = items; feedFetchedAt = Date.now(); paintFeed(items);
    })
    .catch(function(){
      $("feed-meta").textContent = "Couldn't load — try later";
      if(!feedCache) $("feed-list").innerHTML = '<p class="status">No notifications loaded yet.</p>';
    });
}
$("tabs").querySelectorAll("button").forEach(function(b){
  b.addEventListener("click", function(){ showTab(b.getAttribute("data-t")); });
});
window.addEventListener("hashchange", function(){ showTab(location.hash.slice(1)); });

openDB().then(function(){
  return idbGet();
}).then(function(s){
  if(!s){
    try{ var ls = localStorage.getItem("singularity." + STORE); if(ls) s = JSON.parse(ls); }catch(e){}
  }
  applyStored(s);
  if(!state.videos.length) state.videos = SEED_VIDEOS.slice();
  if(timer.running){
    if(timer.endsAt <= Date.now()) completeTimer(true);
    else timer.left = timer.endsAt - Date.now();
  }
  renderPresetSelect(); renderCustomRows(); refreshSelectors();
  renderTimer(); renderExams(); renderNotes(); renderApps(); renderVideos(); renderAmb(); renderWater(); buildNotifs();
  renderSync(); refreshSyncUser();
  if(state.dockUrl){ $("dock-url").value = state.dockUrl; }
  $("storage-note").textContent = (useIDB && db)
    ? "Stored in this browser's database. Not synced between devices — iOS Safari can clear it after 7 days without a visit, so export a backup weekly or add this page to your home screen."
    : "Stored in this browser only. Export a backup regularly.";
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    document.querySelectorAll("animate.morph").forEach(function(a){ a.remove(); });
  }
  /* time of day: automatic, tap the chip to cycle */
  var TOD = [
    {k:"dawn",  icon:"\u25D0", label:"Dawn"},
    {k:"day",   icon:"\u2600", label:"Day"},
    {k:"sunset",icon:"\u25D1", label:"Sunset"},
    {k:"night", icon:"\u263D", label:"Night"}
  ];
  var todOverride = null;
  function autoTod(){
    var hr = new Date().getHours();
    if(hr >= 5 && hr < 8) return "dawn";
    if(hr >= 8 && hr < 16) return "day";
    if(hr >= 16 && hr < 19) return "sunset";
    return "night";
  }
  function applyTod(){
    var key = todOverride || autoTod();
    var scene = document.querySelector(".scene");
    TOD.forEach(function(t){ scene.classList.toggle("t-"+t.k, t.k === key); });
    var cur = TOD.filter(function(t){ return t.k === key; })[0];
    $("tod-btn").querySelector("i").textContent = cur.icon;
    $("tod-label").textContent = cur.label;
    /* say so when the scene is pinned, otherwise it looks like the clock stopped working */
    $("tod-btn").classList.toggle("pinned", !!todOverride);
    $("tod-btn").title = todOverride
      ? cur.label + " — pinned. Tap to keep cycling; it follows the clock again on the last step."
      : cur.label + " — following the clock. Tap to pin a different time.";
  }
  $("tod-btn").addEventListener("click", function(){
    var key = todOverride || autoTod();
    var i = TOD.findIndex(function(t){ return t.k === key; });
    var next = TOD[(i+1) % TOD.length].k;
    todOverride = (next === autoTod()) ? null : next;
    applyTod();
  });
  applyTod();
  setInterval(function(){ if(!todOverride) applyTod(); }, 60000);

  function sizeChrome(){
    var hd = document.querySelector(".head"), ft = document.querySelector(".foot");
    document.documentElement.style.setProperty("--headH", (hd ? hd.offsetHeight : 70) + "px");
    document.documentElement.style.setProperty("--footH", (ft ? ft.offsetHeight : 48) + "px");
  }
  sizeChrome();
  window.addEventListener("resize", sizeChrome);
  showTab(location.hash.slice(1) || "timer");
  setInterval(tick, 250);
  save();
}).catch(function(err){ if(window.console) console.error("Boot failed:", err); });
}
