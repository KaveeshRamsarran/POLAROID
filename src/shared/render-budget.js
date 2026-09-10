// Hysteresis avoids resolution pumping. Ignore loading, paused and long tab gaps.
export function createFrameBudget() {
  let scale = 1,
    sum = 0,
    count = 0,
    good = 0,
    cool = 3;
  return {
    get scale() {
      return scale;
    },
    reset() {
      sum = count = good = 0;
      cool = 3;
    },
    sample(milliseconds, active = true) {
      if (!active || milliseconds <= 0 || milliseconds > 150) {
        sum = count = 0;
        return scale;
      }
      cool -= milliseconds / 1000;
      if (cool > 0) return scale;
      sum += milliseconds;
      count++;
      if (count < 90) return scale;
      const mean = sum / count;
      sum = count = 0;
      if (mean > 21 && scale > 0.65) {
        scale = Math.max(0.65, scale - 0.1);
        cool = 3;
        good = 0;
      } else if (mean < 14) {
        if (++good >= 4 && scale < 1) {
          scale = Math.min(1, scale + 0.05);
          cool = 5;
          good = 0;
        }
      } else good = 0;
      return scale;
    },
  };
}
