"""
Smooths an auto-traced SVG outline.

The source was produced by tracing a bitmap, so every point sits on a whole-pixel
grid and each curve is a staircase of one-unit steps. Three passes fix that:

  1. Ramer-Douglas-Peucker collapses each staircase into the straight run it was
     approximating. The tolerance is just over one unit, so it eats the step
     noise and nothing else.
  2. Corner detection then asks which of the surviving vertices are real corners
     — the knife tip, the fork tines, the point where the bubble's tail meets
     its body — by looking at how sharply the outline turns there.
  3. Everything between corners is refitted as centripetal Catmull-Rom, converted
     to cubic Beziers. Centripetal (alpha 0.5) rather than uniform because the
     uniform form overshoots on the uneven point spacing RDP leaves behind, and
     an overshoot on a logo reads as a dent.

Corners are passed through untouched, so the shape keeps its sharp features and
only the parts that were meant to be curves become curves.
"""
import math
import re
import sys

RDP_TOLERANCE = 1.35
CORNER_DEGREES = 42.0


def parse_path(d):
    """The traced paths are all absolute M/L plus a closing Z, so points is enough."""
    nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", d)]
    pts = list(zip(nums[0::2], nums[1::2]))
    # A trace often repeats the start point at the end; a closed ring must not.
    if len(pts) > 1 and math.dist(pts[0], pts[-1]) < 1e-9:
        pts.pop()
    return pts


def perpendicular_distance(p, a, b):
    if a == b:
        return math.dist(p, a)
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)


def rdp(points, epsilon):
    if len(points) < 3:
        return list(points)
    first, last = points[0], points[-1]
    index, worst = 0, 0.0
    for i in range(1, len(points) - 1):
        dist = perpendicular_distance(points[i], first, last)
        if dist > worst:
            index, worst = i, dist
    if worst > epsilon:
        return rdp(points[: index + 1], epsilon)[:-1] + rdp(points[index:], epsilon)
    return [first, last]


def simplify_ring(points, epsilon):
    """RDP on a closed ring: rotate to a likely corner first so the seam isn't arbitrary."""
    start = max(range(len(points)), key=lambda i: turn_angle(points, i))
    rotated = points[start:] + points[:start]
    simplified = rdp(rotated + [rotated[0]], epsilon)
    if len(simplified) > 1 and math.dist(simplified[0], simplified[-1]) < 1e-9:
        simplified.pop()
    return simplified


def turn_angle(points, i):
    """Degrees the outline turns at vertex i — 0 is straight through."""
    n = len(points)
    prev, here, nxt = points[(i - 1) % n], points[i], points[(i + 1) % n]
    v1 = (here[0] - prev[0], here[1] - prev[1])
    v2 = (nxt[0] - here[0], nxt[1] - here[1])
    len1, len2 = math.hypot(*v1), math.hypot(*v2)
    if len1 == 0 or len2 == 0:
        return 0.0
    cos = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (len1 * len2)))
    return math.degrees(math.acos(cos))


def catmull_rom_controls(p0, p1, p2, p3, alpha=0.5):
    """Centripetal Catmull-Rom segment p1->p2, returned as two cubic Bezier controls."""
    def t_step(ti, a, b):
        d = math.dist(a, b)
        return ti + (d ** alpha if d > 0 else 1e-6)

    t0 = 0.0
    t1 = t_step(t0, p0, p1)
    t2 = t_step(t1, p1, p2)
    t3 = t_step(t2, p2, p3)

    def tangent(pa, pb, ta, tb):
        return ((pb[0] - pa[0]) / (tb - ta), (pb[1] - pa[1]) / (tb - ta))

    m1 = tangent(p0, p2, t0, t2)
    m2 = tangent(p1, p3, t1, t3)
    span = t2 - t1
    c1 = (p1[0] + m1[0] * span / 3.0, p1[1] + m1[1] * span / 3.0)
    c2 = (p2[0] - m2[0] * span / 3.0, p2[1] - m2[1] * span / 3.0)
    return c1, c2


def smooth_ring(points):
    n = len(points)
    corners = {i for i in range(n) if turn_angle(points, i) >= CORNER_DEGREES}
    # A ring with no corners at all is a blob; treat every vertex as smooth.
    out = [f"M {fmt(points[0])}"]
    for i in range(n):
        a, b = points[i], points[(i + 1) % n]
        # A segment leaving or arriving at a corner takes its tangent from the
        # segment itself, which is what keeps the corner sharp.
        p0 = a if i in corners else points[(i - 1) % n]
        p3 = b if (i + 1) % n in corners else points[(i + 2) % n]
        c1, c2 = catmull_rom_controls(p0, a, b, p3)
        out.append(f"C {fmt(c1)} {fmt(c2)} {fmt(b)}")
    out.append("Z")
    return " ".join(out)


def fmt(p):
    return f"{round(p[0], 2):g},{round(p[1], 2):g}"


def main(src, dst):
    svg = open(src).read()
    paths = re.findall(r'<path d="([^"]+)"', svg)
    if len(paths) != 2:
        sys.exit(f"expected 2 paths, found {len(paths)}")

    rebuilt = []
    for d in paths:
        pts = parse_path(d)
        simple = simplify_ring(pts, RDP_TOLERANCE)
        rebuilt.append((len(pts), len(simple), smooth_ring(simple)))

    for before, after, _ in rebuilt:
        print(f"  {before:4d} points -> {after:3d} after simplify")

    out = svg
    for d, (_, _, new_d) in zip(paths, rebuilt):
        out = out.replace(f'<path d="{d}"', f'<path d="{new_d}"')
    open(dst, "w").write(out)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
