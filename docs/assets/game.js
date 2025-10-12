(function(){
  const el = (s)=>document.querySelector(s);
  const fmtPct = (x)=> x==null ? "–" : (Math.round(x*1000)/10).toFixed(1)+"%";
  const fmt2 = (x)=> x==null ? "–" : (Math.round(x*100)/100).toFixed(2);

  function getParams(){
    const p = new URLSearchParams(location.search);
    return {
      id: p.get("id"),                  // e.g., 2024-10-30_UTA_LAL
      league: p.get("league") || null   // e.g., nba / nhl
    };
  }

  async function loadJSON(path){
    const r = await fetch(path, {cache:"no-store"});
    if(!r.ok) throw new Error("Load failed: "+path);
    return await r.json();
  }

  async function tryLoad(path){
    try { return await loadJSON(path); } catch { return null; }
  }

  function renderWinProbs(pred){
    const rt = pred?.preds?.rt || {};
    const ft = pred?.preds?.ft || {};
    el("#ft-home").textContent = fmtPct(ft.home);
    el("#ft-away").textContent = fmtPct(ft.away);
    el("#ft-draw").textContent = "—";

    el("#rt-home").textContent = fmtPct(rt.home);
    el("#rt-draw").textContent = fmtPct(rt.draw);
    el("#rt-away").textContent = fmtPct(rt.away);

    const mu = pred?.preds?.mu || {};
    const sd = pred?.preds?.std || {};
    el("#mu-home").textContent = fmt2(mu.home);
    el("#mu-away").textContent = fmt2(mu.away);
    el("#sd-home").textContent = fmt2(sd.home);
    el("#sd-away").textContent = fmt2(sd.away);
  }

  function renderLadder(arr, tbodySel, valueKey){
    const tbody = el(tbodySel);
    tbody.innerHTML = "";
    if(!Array.isArray(arr) || !arr.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">No data</td>`;
      tbody.appendChild(tr);
      return;
    }
    // sort by threshold ascending
    const copy = [...arr].sort((a,b)=> (a.hcp ?? a.points) - (b.hcp ?? b.points));
    for(const row of copy){
      const t = row.hcp ?? row.points;
      const p = row[valueKey];
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${t}</td><td>${fmtPct(p)}</td>`;
      tbody.appendChild(tr);
    }
  }

  function setHeader(pred){
    const home = pred?.home_team || "Home";
    const away = pred?.away_team || "Away";
    const when = pred?.start_time_utc ? pred.start_time_utc.replace("T"," ").replace("Z"," UTC") : "";
    el("#title").textContent = `${away} @ ${home}`;
    el("#subtitle").textContent = when ? `Start: ${when}` : "";
  }

  function renderResult(pred, res){
    if(!res) return;
    const home = pred?.home_team || "Home";
    const away = pred?.away_team || "Away";
    const hs = res.home_score ?? res.home_team;
    const as = res.away_score ?? res.away_team;
    if(hs==null || as==null) return;
    el("#result-line").textContent = `${away} ${as} — ${home} ${hs}`;
    el("#result-box").style.display = "";
  }

  async function init(){
    const { id, league } = getParams();
    el("#year").textContent = new Date().getFullYear();
    if(!id){
      el("#title").textContent = "Game not found";
      el("#subtitle").textContent = "Missing ?id=YYYY-MM-DD_HOME_AWAY";
      return;
    }
    const basePred = league ? `data/${league}/predictions/${id}.json` : `data/predictions/${id}.json`;
    const baseRes  = league ? `data/${league}/results/${id}.json`     : `data/results/${id}.json`;

    let res = await tryLoad(baseRes);
    let pred = await tryLoad(basePred);
    
    if(!pred){
      el("#title").textContent = "Game not found";
      el("#subtitle").textContent = `No prediction JSON at ${basePred}`;
      return;
    }

    setHeader(pred);
    renderWinProbs(pred);
    renderLadder(pred?.preds?.hcp, "#hcp-table tbody", "prob");
    renderLadder(pred?.preds?.ou,  "#ou-table tbody",  "prob");

    if (res) {
        renderResult(pred, res); 
    }

    // backlink preserves league param
    const back = new URL("index.html", location.href);
    if(league) back.searchParams.set("league", league);
    el("#backlink").href = back.toString();
  }

  init();
})();
