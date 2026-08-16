function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Counts consecutive active days ending today, or ending yesterday if the
// user hasn't been active yet today (so a streak isn't lost until a full day
// is missed).
function computeCurrentStreak(dateKeys) {
  const days = new Set(dateKeys);
  const cursor = new Date();
  let key = cursor.toISOString().slice(0, 10);

  if (!days.has(key)) {
    cursor.setDate(cursor.getDate() - 1);
    key = cursor.toISOString().slice(0, 10);
  }

  let streak = 0;
  while (days.has(key)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    key = cursor.toISOString().slice(0, 10);
  }
  return streak;
}

module.exports = { todayKey, computeCurrentStreak };
