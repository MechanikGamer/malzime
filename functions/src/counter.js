const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HOURLY_LIMIT, HOURLY_WINDOW_MINUTES } = require("./config");

const CURRENT_DOC = "stats/current";
const TOTALS_DOC = "stats/totals";

/**
 * Prüft ob das Limit erreicht ist und erhöht den Zähler.
 * Gibt { allowed, retryAfterSeconds, count, limit } zurück.
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
      const windowMs = (data.windowMinutes || HOURLY_WINDOW_MINUTES) * 60 * 1000;
      const now = Date.now();

      const hourlyTotal = data.hourlyTotal || 0;

      /* Limit war aktiv — prüfen ob das Zeitfenster abgelaufen ist */
      if (data.limitReachedAt) {
        const limitTime = data.limitReachedAt.toMillis ? data.limitReachedAt.toMillis() : data.limitReachedAt;
        const elapsed = now - limitTime;

        if (elapsed < windowMs) {
          const retryAfterSeconds = Math.ceil((windowMs - elapsed) / 1000);
          return { allowed: false, retryAfterSeconds, count: data.count || 0, limit, hourlyTotal };
        }

        /* Zeitfenster abgelaufen → alles zurücksetzen (neues Fenster) */
        tx.set(ref, {
          count: 1,
          hourlyTotal: 1,
          limitReachedAt: null,
          limit: HOURLY_LIMIT,
          windowMinutes: data.windowMinutes || HOURLY_WINDOW_MINUTES,
        });
        return { allowed: true, retryAfterSeconds: 0, count: 1, limit: HOURLY_LIMIT, hourlyTotal: 1 };
      }

      /* Admin-Reset erkannt: limitReachedAt gelöscht, aber count >= limit
         → Limit-Zähler frisch starten, hourlyTotal weiterzählen */
      const currentCount = data.count || 0;
      if (!data.limitReachedAt && currentCount >= limit) {
        const newHourly = hourlyTotal + 1;
        tx.set(ref, {
          count: 1,
          hourlyTotal: newHourly,
          limitReachedAt: null,
          limit,
          windowMinutes: data.windowMinutes || HOURLY_WINDOW_MINUTES,
        });
        return { allowed: true, retryAfterSeconds: 0, count: 1, limit, hourlyTotal: newHourly };
      }

      /* Normaler Betrieb: beide Zähler erhöhen */
      const newCount = currentCount + 1;
      const newHourly = hourlyTotal + 1;

      if (newCount > limit) {
        /* Über dem Limit (Sicherheitsnetz) */
        tx.set(ref, {
          count: newCount,
          hourlyTotal: newHourly,
          limitReachedAt: data.limitReachedAt || new Date(now),
          limit,
          windowMinutes: data.windowMinutes || HOURLY_WINDOW_MINUTES,
        });
        const retryAfterSeconds = Math.ceil(windowMs / 1000);
        return { allowed: false, retryAfterSeconds, count: newCount, limit, hourlyTotal: newHourly };
      }

      if (newCount === limit) {
        /* Limit gerade erreicht — letzte Analyse erlauben, dann sperren */
        tx.set(ref, {
          count: newCount,
          hourlyTotal: newHourly,
          limitReachedAt: new Date(now),
          limit,
          windowMinutes: data.windowMinutes || HOURLY_WINDOW_MINUTES,
        });
        return {
          allowed: true,
          retryAfterSeconds: 0,
          count: newCount,
          limit,
          justReached: true,
          hourlyTotal: newHourly,
        };
      }

      /* Noch unter dem Limit */
      if (snap.exists) {
        tx.update(ref, { count: newCount, hourlyTotal: newHourly });
      } else {
        tx.set(ref, {
          count: newCount,
          hourlyTotal: newHourly,
          limitReachedAt: null,
          limit: HOURLY_LIMIT,
          windowMinutes: HOURLY_WINDOW_MINUTES,
        });
      }
      return { allowed: true, retryAfterSeconds: 0, count: newCount, limit, hourlyTotal: newHourly };
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
 */
async function getStats() {
  try {
    const db = getFirestore();
    const [currentSnap, totalsSnap] = await Promise.all([db.doc(CURRENT_DOC).get(), db.doc(TOTALS_DOC).get()]);

    const current = currentSnap.exists
      ? currentSnap.data()
      : { count: 0, limit: HOURLY_LIMIT, windowMinutes: HOURLY_WINDOW_MINUTES };
    const totals = totalsSnap.exists ? totalsSnap.data() : { today: 0, week: 0, month: 0, year: 0, allTime: 0 };

    let retryAfterSeconds = 0;
    if (current.limitReachedAt) {
      const limitTime = current.limitReachedAt.toMillis ? current.limitReachedAt.toMillis() : current.limitReachedAt;
      const windowMs = (current.windowMinutes || HOURLY_WINDOW_MINUTES) * 60 * 1000;
      const remaining = windowMs - (Date.now() - limitTime);
      retryAfterSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }

    const currentLimit = current.limit || HOURLY_LIMIT;
    const limitCount = current.count || 0;
    const limitActive = retryAfterSeconds > 0 && limitCount >= currentLimit;

    return {
      current: {
        count: limitCount,
        limit: currentLimit,
        limitActive,
        retryAfterSeconds: limitActive ? retryAfterSeconds : 0,
        hourlyTotal: current.hourlyTotal || limitCount,
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
 */
async function boostLimit(amount = 100) {
  const db = getFirestore();
  const ref = db.doc(CURRENT_DOC);
  await ref.update({ limit: FieldValue.increment(amount), limitReachedAt: null });
}

/**
 * Setzt den Stunden-Zähler zurück (Admin-Funktion, für ntfy-Buttons).
 */
async function resetCounter() {
  const db = getFirestore();
  const ref = db.doc(CURRENT_DOC);
  await ref.update({ count: 0, limitReachedAt: null, limit: HOURLY_LIMIT });
}

module.exports = { checkAndIncrement, incrementTotals, getStats, boostLimit, resetCounter };
