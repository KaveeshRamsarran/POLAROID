// Swept collision and route finding, independent of any chapter layout.
export function routeApproaches(start, route, point, radius = 0.7) {
  let a = start;
  for (const b of route) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    const t = length2
      ? Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2),
        )
      : 0;
    if (Math.hypot(a.x + t * dx - point.x, a.z + t * dz - point.z) < radius)
      return true;
    a = b;
  }
  return false;
}

export function createNavigation({
  solids,
  doors,
  floorAt,
  canOpen = () => true,
}) {
  function inactive(box, planning) {
    if (!box.door) return false;
    if (box.openLeaf) return !doors[box.door];
    return !!doors[box.door] || (planning && canOpen(box.door));
  }
  function blocked(x, z, r = 0.23, planning = false) {
    const y = floorAt(x, z);
    if (y === null) return true;
    for (const [dx, dz] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ])
      if (
        floorAt(x + dx, z + dz) === null ||
        Math.abs(floorAt(x + dx, z + dz) - y) > 0.5
      )
        return true;
    return solids.some(
      (b) =>
        !inactive(b, planning) &&
        y + 1.5 > b.y1 &&
        y + 0.1 < b.y2 &&
        x > b.x1 - r &&
        x < b.x2 + r &&
        z > b.z1 - r &&
        z < b.z2 + r,
    );
  }
  function clear(a, b, r = 0.23, planning = false) {
    const d = Math.hypot(b.x - a.x, b.z - a.z),
      n = Math.ceil(d / 0.18);
    for (let i = 0; i <= n; i++)
      if (
        blocked(
          a.x + ((b.x - a.x) * i) / (n || 1),
          a.z + ((b.z - a.z) * i) / (n || 1),
          r,
          planning,
        )
      )
        return false;
    // Sampled walks alone miss a thin diagonal intersection at a wall corner.
    // Sweep the navigation radius against every wall's expanded rectangle.
    for (const box of solids) {
      if (inactive(box, planning)) continue;
      let enter = 0,
        leave = 1,
        hit = true;
      for (const axis of ["x", "z"]) {
        const delta = b[axis] - a[axis],
          lo = box[axis + "1"] - r,
          hi = box[axis + "2"] + r;
        if (Math.abs(delta) < 1e-8) {
          if (a[axis] <= lo || a[axis] >= hi) {
            hit = false;
            break;
          }
        } else {
          let t0 = (lo - a[axis]) / delta,
            t1 = (hi - a[axis]) / delta;
          if (t0 > t1) [t0, t1] = [t1, t0];
          enter = Math.max(enter, t0);
          leave = Math.min(leave, t1);
          if (enter >= leave) {
            hit = false;
            break;
          }
        }
      }
      if (hit) {
        const t = (enter + leave) / 2,
          y = floorAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (y !== null && y + 1.5 > box.y1 && y + 0.1 < box.y2) return false;
      }
    }
    return true;
  }
  function path(a, b) {
    if (clear(a, b, 0.22, true)) return [{ x: b.x, z: b.z }];
    const step = 0.5,
      key = (x, z) => `${x},${z}`,
      start = { x: Math.round(a.x / step), z: Math.round(a.z / step) },
      goal = { x: Math.round(b.x / step), z: Math.round(b.z / step) };
    const q = [start],
      seen = new Map([[key(start.x, start.z), null]]);
    let end = null;
    for (let cursor = 0; cursor < q.length && cursor < 18000; cursor++) {
      const n = q[cursor];
      if (
        Math.hypot(n.x - goal.x, n.z - goal.z) <= 1 &&
        clear({ x: n.x * step, z: n.z * step }, b, 0.22, true)
      ) {
        end = n;
        break;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const p = { x: n.x + dx, z: n.z + dz },
          k = key(p.x, p.z);
        if (
          seen.has(k) ||
          !clear(
            { x: n.x * step, z: n.z * step },
            { x: p.x * step, z: p.z * step },
            0.22,
            true,
          )
        )
          continue;
        seen.set(k, n);
        q.push(p);
      }
    }
    if (!end) return [];
    const out = [{ x: b.x, z: b.z }];
    while (end) {
      out.push({ x: end.x * step, z: end.z * step });
      end = seen.get(key(end.x, end.z));
    }
    out.reverse();
    return out;
  }
  return { blocked, clear, path };
}
