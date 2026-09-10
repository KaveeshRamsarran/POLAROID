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
  let topology = "";
  const edges = new Map();
  function path(a, b) {
    if (clear(a, b, 0.22, true)) return [{ x: b.x, z: b.z }];
    // Reuse swept grid edges between patrol searches. Door state, permissions
    // and animated leaf bounds invalidate the cache before it can serve a route.
    const current = solids
      .map((s) =>
        [s.x1, s.x2, s.y1, s.y2, s.z1, s.z2, inactive(s, true)].join(","),
      )
      .join(";");
    if (current !== topology) {
      topology = current;
      edges.clear();
    }
    const step = 0.5,
      key = (x, z) => `${x},${z}`,
      start = { x: Math.round(a.x / step), z: Math.round(a.z / step) },
      goal = { x: Math.round(b.x / step), z: Math.round(b.z / step) };
    function gridClear(a, b) {
      const ak = key(a.x, a.z),
        bk = key(b.x, b.z);
      const k = ak < bk ? `${ak}/${bk}` : `${bk}/${ak}`;
      if (!edges.has(k))
        edges.set(
          k,
          clear(
            { x: a.x * step, z: a.z * step },
            { x: b.x * step, z: b.z * step },
            0.22,
            true,
          ),
        );
      return edges.get(k);
    }
    // A* explores toward the destination instead of flooding the whole motel.
    // All edges still use the same swept collision checks as player movement.
    const heap = [],
      closed = new Set(),
      seen = new Map([[key(start.x, start.z), null]]),
      costs = new Map([[key(start.x, start.z), 0]]);
    const estimate = (n) => Math.hypot(n.x - goal.x, n.z - goal.z);
    function push(node) {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].score <= node.score) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = node;
    }
    function pop() {
      const first = heap[0],
        last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++;
          if (last.score <= heap[c].score) break;
          heap[i] = heap[c];
          i = c;
        }
        heap[i] = last;
      }
      return first;
    }
    push({ ...start, cost: 0, score: estimate(start) });
    let end = null;
    for (let cursor = 0; heap.length && cursor < 18000; cursor++) {
      const n = pop(),
        nk = key(n.x, n.z);
      if (closed.has(nk)) continue;
      closed.add(nk);
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
          k = key(p.x, p.z),
          cost = n.cost + Math.hypot(dx, dz);
        if (
          closed.has(k) ||
          (costs.has(k) && costs.get(k) <= cost) ||
          !gridClear(n, p)
        )
          continue;
        seen.set(k, n);
        costs.set(k, cost);
        push({ ...p, cost, score: cost + estimate(p) });
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
