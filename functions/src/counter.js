const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HOURLY_LIMIT, HOURLY_WINDOW_MINUTES } = require("./config");

const CURRENT_DOC = "stats/current";
const TOTALS_DOC = "stats/totals";

/**
 * Filtert das recentAnalyses-Array: nur Timestamps der letzten windowMs behalten.
 * Behandelt sowohl Firestore-Timestamps (.toMillis()) als auch plain Numbers.
 */
function filterRecent(arr, now, windowMs) {
  return (arr || []).map((ts) => (ts && ts.toMillis ? ts.toMillis() : ts)).filter((ts) => now - ts < windowMs);
}

/**
 * Berechnet die Sekunden bis der nächste Eintrag aus dem Fenster fällt
 * und damit der Count unter das Limit sinkt.
 */
function calcRetrySeconds(recent, limit, now, windowMs) {
  if (recent.length < limit) return 0;
  const sorted = [...recent].sort((a, b) => a - b);
  const pivotIndex = recent.length - limit; // dieser Eintrag muss rausfallen
  return Math.max(1, Math.ceil((windowMs - (now - sorted[pivotIndex])) / 1000));
}

/**
 * Prüft ob das Limit erreicht ist und erhöht den Zähler.
 *
 * Das Limit basiert auf einem echten rollenden Fenster: recentAnalyses
 * enthält die Timestamps aller Analysen der letzten 60 Minuten.
 * Sobald genug alte Einträge herausfallen, ist das System sofort wieder frei.
 *
 * Bei Firestore-Fehler: fail-open (allowed: true).
 */
async function checkAndIncrement() {
  try {
    const db = getFirestore();
    const ref = db.doc(CURRENT_DOC);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};

      const limit = data.limit || HOURLY_LIMIT;
      const wm = data.windowMinutes || HOURLY_WINDOW_MINUTES;
      const windowMs = wm * 60 * 1000;
      const now = Date.now();

      /* Rollendes Fenster: nur Analysen der letzten Stunde */
      const recent = filterRecent(data.recentAnalyses, now, windowMs);

      /* Limit erreicht → blockieren */
      if (recent.length >= limit) {
        const retryAfterSeconds = calcRetrySeconds(recent, limit, now, windowMs);
        return {
          allowed: false,
          retryAfterSeconds,
          count: recent.length,
          limit,
          hourlyTotal: recent.length,
        };
      }

      /* Unter dem Limit → Analyse erlauben */
      recent.push(now);
      const justReached = recent.length === limit;

      if (snap.exists) {
        tx.update(ref, { recentAnalyses: recent });
      } else {
        tx.set(ref, {
          recentAnalyses: recent,
          limit: HOURLY_LIMIT,
          windowMinutes: HOURLY_WINDOW_MINUTES,
        });
      }

      return {
        allowed: true,
        retryAfterSeconds: 0,
        count: recent.length,
        limit,
        hourlyTotal: recent.length,
        justReached,
      };
    });

    return result;
  } catch (err) {
    /* Fail-open: Lieber ein paar Analysen zu viel als alle User blockieren */
    console.log(JSON.stringify({ warning: "counter-error", error: err.message }));
    return { allowed: true, retryAfterSeconds: 0, count: -1, limit: HOURLY_LIMIT, error: err.message };
  }
}

/**
 * Erhöht die Gesamt-Statistiken (today/week/month/year/allTime).
 * Wird nach erfolgreicher Analyse aufgerufen.
 */
async function incrementTotals() {
  try {
    const db = getFirestore();
    const ref = db.doc(TOTALS_DOC);

    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const yearKey = String(now.getFullYear());

    /* Wochenstart (Montag) berechnen */
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const weekStart = monday.toISOString().slice(0, 10);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};

      const updates = { allTime: (data.allTime || 0) + 1 };

      /* Tages-Zähler */
      if (data.todayDate === todayDate) {
        updates.today = (data.today || 0) + 1;
      } else {
        updates.today = 1;
        updates.todayDate = todayDate;
      }

      /* Wochen-Zähler */
      if (data.weekStart === weekStart) {
        updates.week = (data.week || 0) + 1;
      } else {
        updates.week = 1;
        updates.weekStart = weekStart;
      }

      /* Monats-Zähler */
      if (data.monthKey === monthKey) {
        updates.month = (data.month || 0) + 1;
      } else {
        updates.month = 1;
        updates.monthKey = monthKey;
      }

      /* Jahres-Zähler */
      if (data.yearKey === yearKey) {
        updates.year = (data.year || 0) + 1;
      } else {
        updates.year = 1;
        updates.yearKey = yearKey;
      }

      tx.set(ref, updates, { merge: true });
    });
  } catch (err) {
    /* Totals-Fehler sind nicht kritisch — Analyse geht trotzdem weiter */
    console.log(JSON.stringify({ warning: "totals-error", error: err.message }));
  }
}

/**
 * Liest die aktuellen Stats für den öffentlichen API-Endpunkt.
 * Alles basiert auf dem rollenden Fenster (recentAnalyses).
 */
async function getStats() {
  try {
    const db = getFirestore();
    const [currentSnap, totalsSnap] = await Promise.all([db.doc(CURRENT_DOC).get(), db.doc(TOTALS_DOC).get()]);

    const current = currentSnap.exists
      ? currentSnap.data()
      : { limit: HOURLY_LIMIT, windowMinutes: HOURLY_WINDOW_MINUTES };
    const totals = totalsSnap.exists ? totalsSnap.data() : { today: 0, week: 0, month: 0, year: 0, allTime: 0 };

    const currentLimit = current.limit || HOURLY_LIMIT;
    const wm = current.windowMinutes || HOURLY_WINDOW_MINUTES;
    const windowMs = wm * 60 * 1000;
    const now = Date.now();

    const rawLength = (current.recentAnalyses || []).length;
    const recent = filterRecent(current.recentAnalyses, now, windowMs);
    const recentCount = recent.length;
    const limitActive = recentCount >= currentLimit;
    const retryAfterSeconds = limitActive ? calcRetrySeconds(recent, currentLimit, now, windowMs) : 0;

    /* Cleanup: alte Eintraege in Firestore bereinigen (fire-and-forget) */
    if (rawLength - recentCount >= 10) {
      db.doc(CURRENT_DOC)
        .update({ recentAnalyses: recent })
        .catch(() => {});
    }

    return {
      current: {
        count: recentCount,
        limit: currentLimit,
        limitActive,
        retryAfterSeconds,
        hourlyTotal: recentCount,
      },
      totals: {
        today: totals.today || 0,
        week: totals.week || 0,
        month: totals.month || 0,
        year: totals.year || 0,
        allTime: totals.allTime || 0,
      },
    };
  } catch (err) {
    console.log(JSON.stringify({ warning: "stats-read-error", error: err.message }));
    return null;
  }
}

/**
 * Erhöht das Limit um den angegebenen Betrag (Admin-Funktion, für ntfy-Buttons).
 * Wenn der aktuelle Count unter dem neuen Limit liegt, ist das System sofort frei.
 */
async function boostLimit(amount = 100) {
  const db = getFirestore();
  const ref = db.doc(CURRENT_DOC);
  await ref.update({ limit: FieldValue.increment(amount) });
}

/**
 * Setzt alles zurück (Admin-Funktion, für ntfy-Buttons).
 * Leert recentAnalyses → Count sofort 0, System sofort frei.
 */
async function resetCounter() {
  const db = getFirestore();
  const ref = db.doc(CURRENT_DOC);
  await ref.update({ recentAnalyses: [], limit: HOURLY_LIMIT });
}

module.exports = {
  checkAndIncrement,
  incrementTotals,
  getStats,
  boostLimit,
  resetCounter,
  filterRecent,
  calcRetrySeconds,
};
