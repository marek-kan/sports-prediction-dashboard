(function () {
  const fmtPct = (x) => (x === null || x === undefined) ? "-" : (Math.round(x * 1000) / 10).toFixed(1) + "%";
  const fmt2  = (x) => (x === null || x === undefined) ? "-" : (Math.round(x * 100) / 100).toFixed(2);
  const by    = (k) => (a, b) => a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
  const el    = (sel) => document.querySelector(sel);
  const toNum = v => (v === null || v === undefined ? NaN : Number(v));
  const normProb = p => {
    if (p === null || p === undefined) return null;
    const x = typeof p === "string" ? parseFloat(p) : p;
    if (!isFinite(x)) return null;
    // accept 0-1 or 0-100 inputs
    const y = x > 1 ? x / 100 : x;
    return Math.max(0, Math.min(1, y));
  };


  const state = {
    league: "nba",
    preds: [],
    results: [],
    metrics: null,
    charts: { calib: null, trend: null }
  };

  async function loadJSON(path) {
    const resp = await fetch(path, { cache: "no-store" });
    if (!resp.ok) throw new Error("Failed to load " + path);
    return await resp.json();
  }

  function renderKPIs(metrics) {
    el("#kpi-n").textContent = metrics.n || 0;
    el("#kpi-ft-acc").textContent = metrics.ft_accuracy != null ? fmtPct(metrics.ft_accuracy) : "-";
    el("#kpi-ft-acc-text").textContent = `Full-time Accuracy, baseline: ${fmtPct(metrics.ft_accuracy_baseline)}`
    el("#kpi-hcp-acc").textContent = metrics.hcp_accuracy   != null ? fmtPct(metrics.hcp_accuracy)   : "-";
    el("#kpi-hcp-acc-text").textContent = `Handicap Accuracy, baseline: ${fmtPct(metrics.hcp_accuracy_baseline)}`
    el("#kpi-ou-acc").textContent = metrics.over_accuracy != null ? fmtPct(metrics.over_accuracy) : "-";
    el("#kpi-ou-acc-text").textContent = `Over/Under Accuracy, baseline: ${fmtPct(metrics.over_accuracy_baseline)}`
  }

  function renderPredictions(rows) {
    const tbody = el("#predictions-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const now = new Date();
    const teamFilter = (el("#team-filter")?.value || "").trim().toUpperCase();

    rows
      // .filter(r => r.start_time_utc && new Date(r.start_time_utc) > now)
      .filter(r =>
        !teamFilter ||
        (r.home_code || "").toUpperCase().includes(teamFilter) ||
        (r.away_code || "").toUpperCase().includes(teamFilter) ||
        (r.home_team || "").toUpperCase().includes(teamFilter) ||
        (r.away_team || "").toUpperCase().includes(teamFilter)
      )
      .sort(by("start_time_utc"))
      .forEach(r => {
        const tr = document.createElement("tr");
        const id = (r.filename || "").replace(".json","");
        const when = r.start_time_utc ? r.start_time_utc.replace("T", " ").replace("Z", "") : "-";
        const lg = state?.league || "nba"; 
        const href = `game.html?id=${encodeURIComponent(id)}&league=${encodeURIComponent(lg)}`;

        tr.innerHTML = `
          <td>${r.start_time_utc.replace('T',' ').replace('Z','')}</td>
          <td>${r.home_team ?? "-"}</td>
          <td>${r.away_team ?? "-"}</td>
          <td>${fmtPct(r.ft_home)}</td>
          <td>${r.hcp[0]} @ ${fmtPct(r.hcp[1])}</td>
          <td>${r.over[0]} @ ${fmtPct(r.over[1])}</td>
          <td><a href="${href}">Detailed view</a> </td>
        `;
        tbody.appendChild(tr);
      });
  }


  function renderResults(rows) {
    const tbody = el("#results-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const now = new Date();

    const grade = (predProb, realized, posWord, negWord) => {
      if (!realized || realized === "-" || realized === "Push") return realized === "Push" ? "push" : "neutral";
      if (predProb === null) return "neutral";
      const predicted = predProb >= 0.5 ? posWord : negWord;
      return realized === predicted ? "win" : "loss";
    };

    rows
      .filter(r => r.start_time_utc && new Date(r.start_time_utc) <= now)
      .sort((a, b) => new Date(b.start_time_utc) - new Date(a.start_time_utc))
      .slice(0, 200)
      .forEach(r => {
        const tr = document.createElement("tr");

        const id = (r.filename || "").replace(".json", "");
        const lg = state?.league || "nba";
        const href = `game.html?id=${encodeURIComponent(id)}&league=${encodeURIComponent(lg)}`;

        const dateStr = r.start_time_utc ? r.start_time_utc.substring(0, 10) : "-";

        const hs = toNum(r.home_score);
        const as = toNum(r.away_score);
        const hasScore = isFinite(hs) && isFinite(as);
        const scoreStr = hasScore ? `${hs} : ${as}` : "-";

        let ftWord = "-";
        if (hasScore) {
          ftWord = hs > as ? "Home" : hs < as ? "Away" : "Tie";
        }

        // realized HCP outcome (home handicap)
        const spreadRaw = r?.hcp?.[0];
        const spread = toNum(spreadRaw);
        const hasSpread = isFinite(spread);
        let hcpWord = "-";
        if (hasScore && hasSpread) {
          const cmp = (hs - as) + spread;
          hcpWord = cmp > 0 ? "Covered" : cmp < 0 ? "Not covered" : "Push";
        }

        // realized Total outcome
        const totalLineRaw = r?.over?.[0];
        const totalLine = toNum(totalLineRaw);
        const hasTotalLine = isFinite(totalLine);
        let totWord = "-";
        if (hasScore && hasTotalLine) {
          const diff = (hs + as) - totalLine;
          totWord = diff > 0 ? "Over" : diff < 0 ? "Under" : "Push";
        }

        const pFt = normProb(r.ft_home);
        const pHcp = normProb(r?.hcp?.[1]);
        const pOver = normProb(r?.over?.[1]);

        const clsFt  = grade(pFt,  ftWord,  "Home", "Away");
        const clsHcp = grade(pHcp, hcpWord, "Covered", "Not covered");
        const clsTot = grade(pOver, totWord, "Over", "Under");

        const outcomeHtml = `
          <span class="${clsFt}"  title="Pred FT Home: ${fmtPct(pFt)}">${ftWord}</span> /
          <span class="${hcpWord === "Push" ? "push" : clsHcp}" title="Line: ${hasSpread ? spread : "-"} • Pred HCP Home: ${fmtPct(pHcp)}">${hcpWord}</span> /
          <span class="${totWord === "Push" ? "push" : clsTot}" title="Total: ${hasTotalLine ? totalLine : "-"} • Pred Over: ${fmtPct(pOver)}">${totWord}</span>
        `;

        tr.innerHTML = `
          <td>${dateStr}</td>
          <td>${r.home_team ?? "-"}</td>
          <td>${r.away_team ?? "-"}</td>
          <td>${fmtPct(pFt)}</td>
          <td>${hasSpread ? `${spreadRaw} @ ${fmtPct(pHcp)}` : "-"}</td>
          <td>${hasTotalLine ? `${totalLineRaw} @ ${fmtPct(pOver)}` : "-"}</td>
          <td>${scoreStr}</td>
          <td>${outcomeHtml}</td>
          <td><a href="${href}">Detailed view</a></td>
        `;

        tbody.appendChild(tr);
      }
    );
  }

  function renderCalibChart(bins) {
    const canvas = document.getElementById("calibChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Destroy previous chart if any
    if (state.charts.calib) {
      state.charts.calib.destroy();
      state.charts.calib = null;
    }
    if (!bins || !bins.length) return;

    const labels   = bins.map(b => (Math.round(b.bin_center * 1000) / 10).toFixed(1) + "%");
    const expected = bins.map(b => b.bin_center);
    const observed = bins.map(b => b.observed_rate);

    state.charts.calib = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Expected (FT Home)", data: expected },
          { label: "Observed Home Win", data: observed }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 1, ticks: { callback: (v) => (v * 100).toFixed(0) + "%" } }
        }
      }
    });
  }

  function renderTrendChart(series) {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Destroy previous chart if any
    if (state.charts.trend) {
      state.charts.trend.destroy();
      state.charts.trend = null;
    }
    if (!series || !series.length) return;

    const labels = series.map(d => d.date);
    const acc    = series.map(d => d.accuracy);

    state.charts.trend = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: "Accuracy (by day)", data: acc }] },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 1, ticks: { callback: (v) => (v * 100).toFixed(0) + "%" } } }
      }
    });
  }

  function setURLParam(key, value) {
    const url = new URL(window.location.href);
    if (value == null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    history.replaceState({}, "", url.toString());
  }

  async function loadLeagueData(league) {
    console.log(league)
    state.league = league || "nba";
    const base = `data/${state.league}`;
    try {
      const [metrics, preds, results] = await Promise.all([
        loadJSON(`${base}/metrics.json`),
        loadJSON(`${base}/predictions_flat.json`),
        loadJSON(`${base}/results_flat.json`).catch(() => [])
      ]);
      state.metrics = metrics;
      state.preds   = preds || [];
      state.results = results || [];

      renderKPIs(state.metrics);
      renderPredictions(state.preds);
      renderResults(state.results);
      // renderCalibChart(state.metrics?.calibration_bins || []);
      // renderTrendChart(state.metrics?.by_date || []);
    } catch (e) {
      console.error(e);
      alert(`Failed to load ${state.league.toUpperCase()} data. Check console and data files.`);
      // Clear UI if load fails
      renderKPIs({ n: 0, accuracy: null, brier: null, logloss: null });
      renderPredictions([]);
      renderResults([]);
      renderCalibChart([]);
      renderTrendChart([]);
    }
  }

  async function init() {
    // Year in footer
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Determine initial league from URL or select default
    const leagueSel = document.getElementById("league-select");
    const urlLeague = new URLSearchParams(location.search).get("league") || "nba";
    if (leagueSel) {
      leagueSel.value = urlLeague;
    }

    // Attach listeners once
    const teamFilter = el("#team-filter");
    if (teamFilter && !teamFilter.dataset.bound) {
      teamFilter.addEventListener("input", () => renderPredictions(state.preds));
      teamFilter.dataset.bound = "1";
    }
    if (leagueSel && !leagueSel.dataset.bound) {
      leagueSel.addEventListener("change", () => {
        const v = leagueSel.value || "nba";
        setURLParam("league", v);
        loadLeagueData(v);
      });
      leagueSel.dataset.bound = "1";
    }

    await loadLeagueData(urlLeague);
  }

  init();
})();
