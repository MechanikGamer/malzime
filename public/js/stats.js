/* ── Stats-Seite: Lädt /api/stats und befüllt die Anzeige ── */

const fmt = (n) => new Intl.NumberFormat("de").format(n);

async function loadStats() {
  const el = {
    liveCount: document.getElementById("liveCount"),
    totalValue: document.getElementById("totalValue"),
    todayValue: document.getElementById("todayValue"),
    weekValue: document.getElementById("weekValue"),
    monthValue: document.getElementById("monthValue"),
    limitBar: document.getElementById("limitBar"),
    limitLabels: document.getElementById("limitLabels"),
    limitFree: document.getElementById("limitFree"),
    limitBadge: document.getElementById("limitBadge"),
    limitCountdown: document.getElementById("limitCountdownStats"),
    statsError: document.getElementById("statsError"),
  };

  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    /* Zahlen einsetzen */
    el.liveCount.textContent = fmt(data.current.count);
    el.totalValue.textContent = fmt(data.totals.allTime);
    el.todayValue.textContent = fmt(data.totals.today);
    el.weekValue.textContent = fmt(data.totals.week);
    el.monthValue.textContent = fmt(data.totals.month);

    /* Limit-Balken */
    const pct = Math.min(100, (data.current.count / data.current.limit) * 100);
    el.limitBar.style.width = pct.toFixed(1) + "%";

    const colorClass =
      pct < 60 ? "stats-limit__bar-fill--low" : pct < 85 ? "stats-limit__bar-fill--mid" : "stats-limit__bar-fill--high";
    el.limitBar.className = "stats-limit__bar-fill " + colorClass;

    el.limitLabels.textContent = fmt(data.current.count) + " / " + fmt(data.current.limit);
    el.limitFree.textContent = (100 - pct).toFixed(1) + " % frei";

    /* Limit-Status */
    if (data.current.limitActive) {
      el.limitBadge.textContent = "Limit erreicht";
      el.limitBadge.className = "stats-limit__badge stats-limit__badge--warn";
      if (data.current.retryAfterSeconds > 0) {
        startCountdown(data.current.retryAfterSeconds, el.limitCountdown);
      }
    } else {
      el.limitBadge.textContent = "Verf\u00fcgbar";
      el.limitBadge.className = "stats-limit__badge stats-limit__badge--ok";
    }
  } catch (_err) {
    el.statsError.style.display = "block";
  }
}

function startCountdown(seconds, el) {
  if (!el) return;
  el.style.display = "block";
  let remaining = seconds;

  function update() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.textContent =
      m > 0
        ? "Wieder verf\u00fcgbar in " + m + ":" + String(s).padStart(2, "0") + " Min"
        : "Wieder verf\u00fcgbar in " + s + " Sekunden";
  }

  update();
  const iv = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(iv);
      el.textContent = "Analyse wird wieder freigeschaltet\u2026";
      setTimeout(() => location.reload(), 2000);
      return;
    }
    update();
  }, 1000);
}

loadStats();
