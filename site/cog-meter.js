/* COGHEIM milestone meter.
   One file. Edit the MILESTONES list below to change what the bar shows.
   kind: "hit"  = a milestone that has happened (amber side)
         "goal" = a goal that has not happened yet (cyan side)
   date: YYYY-MM-DD. For a goal with only a month, use the last day of that month
         and set show to the text you want displayed, for example "December 2026".
   Amber fills from the left up to today's date. Nothing here is a percentage of work done. */
(function () {
  var MILESTONES = [
    { date: "2026-07-09", kind: "hit",  label: "Cogheim Quintet first drafts complete" },
    { date: "2026-07-12", kind: "hit",  label: "First walkable build in Unreal 5.8" },
    { date: "2026-09-21", kind: "hit",  label: "First player stands on a moving hull" },
    { date: "2026-10-24", kind: "hit",  label: "Walking inside the Drifter while it travels" },
    { date: "2026-11-10", kind: "hit",  label: "The Auger breaches in engine, first pass" },
    { date: "2026-11-12", kind: "hit",  label: "Blackjack assembled in Unreal" },
    { date: "2026-12-31", kind: "goal", label: "First closed playtest aboard the Drifter", show: "December 2026" },
    { date: "2027-11-30", kind: "goal", label: "Full production build", show: "November 2027" }
  ];
  var START = "2026-06-01", END = "2027-12-31", TRACKER = "game-progress.html#meter";

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function d(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(m) { if (m.show) return m.show; var x = d(m.date); return x.getDate() + " " + MON[x.getMonth()] + " " + x.getFullYear(); }
  var t0 = d(START).getTime(), t1 = d(END).getTime(), now = Date.now();
  function pos(t) { return Math.max(0, Math.min(100, (t - t0) / (t1 - t0) * 100)); }
  var nowPct = pos(now);
  MILESTONES.sort(function (a, b) { return d(a.date) - d(b.date); });
  MILESTONES.forEach(function (m) { m.t = d(m.date).getTime(); m.p = pos(m.t); m.done = m.kind === "hit"; });
  var last = null, next = null;
  MILESTONES.forEach(function (m) { if (m.done) last = m; else if (!next) next = m; });

  var css = ""
  + ".cgm{position:fixed;left:0;right:0;z-index:90;height:44px;display:flex;align-items:center;gap:.9rem;padding:0 1rem;"
  + "background:linear-gradient(180deg,#14181d,#0b0e11);border-bottom:1px solid rgba(183,144,60,.35);box-shadow:0 6px 18px rgba(0,0,0,.45);"
  + "font-family:'Saira Condensed','Saira',sans-serif;text-decoration:none;color:#E8E2D4}"
  + ".cgm.cgm-in{position:relative;top:auto;left:auto;right:auto;box-shadow:none;border-top:1px solid rgba(183,144,60,.25)}"
  + ".cgm:focus-visible{outline:2px solid #E0A244;outline-offset:-3px}"
  + ".cgm-side{flex:0 1 auto;max-width:27%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.72rem;letter-spacing:.11em;text-transform:uppercase;font-weight:600}"
  + ".cgm-side b{font-weight:600;margin-right:.45em}"
  + ".cgm-l{color:#E9B866}.cgm-l b{color:#B7903C}.cgm-r{color:#8FD3DF;text-align:right}.cgm-r b{color:#5C9FAC}"
  + ".cgm-go{flex:0 0 auto;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:#0C0F12;background:linear-gradient(180deg,#F0B45A,#C97A24);padding:.22rem .6rem;border-radius:2px}"
  + ".cgm-tube{position:relative;flex:1 1 auto;min-width:120px;margin:0 14px}"
  + ".cgm-big .cgm-tube{display:block;margin:0}"
  /* art kit: Website_Milestone_Meter_Kit_V1 (GPT, 20 Nov 2026). Tile width is 512/96 of tube height. */
  + ".cgm-tube{--h:22px;height:var(--h)}"
  + ".cgm-cap{position:absolute;top:50%;height:calc(var(--h)*1.3333);width:calc(var(--h));margin-top:calc(var(--h)*-.6667);z-index:4;background-size:100% 100%;background-repeat:no-repeat}"
  + ".cgm-cap.a{left:calc(var(--h)*-.82);background-image:url(meter/cap_left.webp)}.cgm-cap.b{right:calc(var(--h)*-.82);background-image:url(meter/cap_right.webp)}"
  + ".cgm-glass{position:absolute;inset:0;overflow:hidden}"
  + ".cgm-cyan{position:absolute;inset:0;background:url(meter/glow_cyan.webp) 0 0/auto 100% repeat-x}"
  + ".cgm-amber{position:absolute;left:0;top:0;bottom:0;width:0;transition:width 2.2s cubic-bezier(.2,.7,.2,1);background:url(meter/fluid_amber.webp) 0 0/auto 100% repeat-x;animation:cgmTile 26s linear infinite;filter:drop-shadow(0 0 6px rgba(242,169,59,.55))}"
  + ".cgm-amber::before{content:'';position:absolute;inset:0;background:url(meter/fluid_bubbles.webp) 0 0/auto 100% repeat-x;animation:cgmTile 14s linear infinite reverse}"
  + ".cgm-amber::after{content:'';position:absolute;right:calc(var(--h)*-.3);top:0;bottom:0;width:calc(var(--h)*.5);background:url(meter/fluid_meniscus.webp) 0 0/100% 100% no-repeat;animation:cgmSlosh 2.6s ease-in-out infinite}"
  + ".cgm-bub{display:none}"
  + ".cgm-shine{position:absolute;inset:0;background:url(meter/tube_glass.webp) 0 0/auto 100% repeat-x;z-index:3;pointer-events:none}"
  + ".cgm-plate{position:absolute;left:calc(var(--h)*-.5);right:calc(var(--h)*-.5);top:50%;height:calc(var(--h)*1.6667);margin-top:calc(var(--h)*-.8333);background:url(meter/backplate.webp) 0 0/auto 100% repeat-x;z-index:0}"
  + ".cgm-glass,.cgm-plate+*{z-index:1}"
  /* marks */
  + ".cgm-mark{position:absolute;top:50%;width:calc(var(--h)*.72);height:calc(var(--h)*.72);margin:calc(var(--h)*-.36) 0 0 calc(var(--h)*-.36);z-index:5;background:url(meter/stud_hit.webp) 0 0/100% 100% no-repeat}"
  + ".cgm-mark.goal{background-image:url(meter/stud_goal.webp)}"
  + ".cgm-now{position:absolute;top:calc(var(--h)*-.42);height:calc(var(--h)*1.6667);width:calc(var(--h)*.3333);margin-left:calc(var(--h)*-.1667);z-index:6;background:url(meter/needle_now.webp) 0 0/100% 100% no-repeat;filter:drop-shadow(0 0 4px rgba(255,240,200,.7))}"
  + ".cgm-now::after{display:none}"
  + "@keyframes cgmTile{from{background-position-x:0}to{background-position-x:calc(var(--h)*-5.3333)}}"
  + "@keyframes cgmFlow{from{background-position:-220px 0}to{background-position:220px 0}}"
  + "@keyframes cgmSlosh{0%,100%{transform:scaleY(.86)}50%{transform:scaleY(1.06) translateX(1px)}}"
  + "@keyframes cgmBub{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-14px) translateX(4px);opacity:0}}"
  + "@media (prefers-reduced-motion:reduce){.cgm-amber{transition:none}.cgm-amber,.cgm-amber::before,.cgm-amber::after,.cgm-bub{animation:none}.cgm-bub{display:none}}"
  + "@media (max-width:900px){.cgm-l{display:none}.cgm-side{max-width:44%}}"
  + "@media (max-width:560px){.cgm{height:38px;gap:.6rem;padding:0 .9rem}.cgm-side{display:none}.cgm-tube{--h:18px}}"
  /* big version on the tracker page */
  + ".cgm-big{position:relative;padding:8.6rem 5.5rem 8.8rem;margin:1.4rem 0 .6rem;border:1px solid rgba(183,144,60,.3);background:linear-gradient(180deg,#12161b,#0a0d10);border-radius:4px;overflow-x:auto}"
  + ".cgm-big .cgm-inner{position:relative;min-width:860px}.cgm-big .cgm-tube{--h:36px;height:var(--h)}"
  + ".cgm-tag{position:absolute;left:0;width:150px;margin-left:-75px;text-align:center;font-family:'Saira Condensed','Saira',sans-serif;line-height:1.25;z-index:7}"
  + ".cgm-tag.up{bottom:calc(100% + 24px)}.cgm-tag.dn{top:calc(100% + 24px)}.cgm-tag.up.t2{bottom:calc(100% + 82px)}.cgm-tag.dn.t2{top:calc(100% + 82px)}"
  + ".cgm-tag.t2::before{height:67px}#meter{scroll-margin-top:120px}"
  + ".cgm-tag i{display:block;font-style:normal;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;font-weight:600}"
  + ".cgm-tag span{display:block;font-size:.8rem;color:#E8E2D4}"
  + ".cgm-tag.hit i{color:#E9B866}.cgm-tag.goal i{color:#8FD3DF}"
  + ".cgm-tag::before{content:'';position:absolute;left:50%;width:1px;height:9px;background:rgba(232,226,212,.35)}"
  + ".cgm-tag.up::before{top:100%}.cgm-tag.dn::before{bottom:100%}"
  + ".cgm-key{display:flex;flex-wrap:wrap;gap:1.2rem;font-family:'Saira Condensed','Saira',sans-serif;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#A2A2A0;margin:.4rem 0 0}"
  + ".cgm-key b{display:inline-block;width:10px;height:10px;margin-right:.45em;vertical-align:-1px}"
  + ".cgm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}";

  function tube(big) {
    var h = '<span class="cgm-tube">' + (big ? '<span class="cgm-plate"></span>' : '') + '<span class="cgm-cap a"></span><span class="cgm-cap b"></span><span class="cgm-glass"><span class="cgm-cyan"></span><span class="cgm-amber" data-w="' + nowPct.toFixed(2) + '">';
    for (var i = 0; i < 5; i++) h += '<span class="cgm-bub" style="left:' + (12 + i * 19) + '%;animation-delay:' + (i * 0.7) + 's"></span>';
    h += '</span><span class="cgm-shine"></span></span>';
    var lastSide = {};
    MILESTONES.forEach(function (m, i) {
      h += '<span class="cgm-mark ' + (m.done ? "hit" : "goal") + '" style="left:' + m.p.toFixed(2) + '%" title="' + fmt(m) + ": " + m.label + (m.done ? "" : " (goal)") + '"></span>';
      if (big) { var side = i % 2 ? "dn" : "up", prev = lastSide[side]; var tier = (prev && m.p - prev.p < 13 && !prev.t2) ? " t2 " : " "; lastSide[side] = { p: m.p, t2: tier !== " " };
        h += '<span class="cgm-tag ' + side + tier + (m.done ? "hit" : "goal") + '" style="left:' + m.p.toFixed(2) + '%"><i>' + fmt(m) + (m.done ? "" : " goal") + '</i><span>' + m.label + '</span></span>'; }
    });
    h += '<span class="cgm-now" style="left:' + nowPct.toFixed(2) + '%"></span></span>';
    return h;
  }
  function srText() {
    return "Project milestones. " + MILESTONES.map(function (m) { return fmt(m) + ", " + m.label + (m.done ? ", reached" : ", goal not yet reached"); }).join(". ") + ".";
  }
  function fill(root) {
    var a = root.querySelectorAll(".cgm-amber");
    requestAnimationFrame(function () { setTimeout(function () { for (var i = 0; i < a.length; i++) a[i].style.width = a[i].getAttribute("data-w") + "%"; }, 120); });
  }
  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var nav = document.querySelector("nav");
    var bar = document.createElement("a");
    bar.className = "cgm"; bar.href = TRACKER; bar.setAttribute("aria-label", "Open the live project tracker. " + srText());
    bar.innerHTML = (last ? '<span class="cgm-side cgm-l"><b>Last hit</b>' + fmt(last) + " &middot; " + last.label + "</span>" : "")
      + tube(false)
      + (next ? '<span class="cgm-side cgm-r"><b>Next goal</b>' + fmt(next) + " &middot; " + next.label + "</span>" : "")
      + '<span class="cgm-go">Live Tracker</span>';
    var hdr = document.querySelector("header.site");
    if (hdr) {
      bar.classList.add("cgm-in");
      hdr.appendChild(bar);
      fill(bar);
    } else {
    document.body.appendChild(bar);
    function place() {
      var nh = nav ? nav.getBoundingClientRect().height : 0;
      bar.style.top = nh + "px";
      document.body.style.paddingTop = bar.offsetHeight + "px";
    }
    place(); window.addEventListener("resize", place); window.addEventListener("load", place);
    fill(bar);
    }
    var big = document.getElementById("cog-meter-big");
    if (big) {
      big.innerHTML = '<div class="cgm-big" role="img" aria-label="' + srText() + '"><div class="cgm-inner">' + tube(true) + "</div></div>"
        + '<p class="cgm-key"><span><b style="background:#F2A93B;border-radius:50%"></b>Milestone reached</span><span><b style="border:1.5px solid #8FD3DF;transform:rotate(45deg)"></b>Goal, not yet reached</span><span><b style="background:#fff;width:2px"></b>Today</span></p>';
      big.querySelector(".cgm-big").classList.add("cgm-bigwrap");
      fill(big);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
