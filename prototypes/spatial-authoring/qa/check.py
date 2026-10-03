#!/usr/bin/env python3
"""Compare a recorded prototype state against an expected subset or a stored baseline.

Two ways to run it, both printing one PASS/FAIL line and exiting nonzero on failure:

  # subset comparison: every key named in the expectation must match
  python3 check.py state.json --expect '{"sel": "gwin", "undo": 2}'

  # baseline comparison: same keys, but read from a baseline file's checkpoints
  python3 check.py state.json --baseline baseline.json --case A3

Numbers compare with an absolute tolerance (default 0.002, override with --tol) so floating-point
projection never reads as a behaviour change while a real move still fails. Strings, booleans and
null compare exactly. Inside objects, the expectation is a recursive subset; inside arrays it is
element-wise and the same length. The token "*" matches any non-null value.
"""
import argparse, json, sys

TOL_DEFAULT = 0.002


def load(path):
    if path == "-":
        return json.loads(sys.stdin.read())
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def get(obj, path):
    cur = obj
    for part in path.split("."):
        if part == "":
            continue
        if isinstance(cur, list):
            cur = cur[int(part)]
        elif isinstance(cur, dict):
            if part not in cur:
                return None
            cur = cur[part]
        else:
            return None
    return cur


def compare(expected, actual, tol, path=""):
    """Return a list of failure strings."""
    bad = []
    where = path or "(root)"
    if expected == "*":
        if actual is None:
            bad.append(f"{where}: expected any value, got null")
        return bad
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{where}: expected an object, got {actual!r}"]
        for key, want in expected.items():
            bad += compare(want, actual.get(key), tol, f"{path}.{key}" if path else key)
        return bad
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return [f"{where}: expected a list, got {actual!r}"]
        if len(expected) != len(actual):
            return [f"{where}: expected {len(expected)} entries, got {len(actual)}"]
        for i, want in enumerate(expected):
            bad += compare(want, actual[i], tol, f"{path}[{i}]")
        return bad
    if isinstance(expected, bool) or isinstance(actual, bool) or expected is None or actual is None:
        if expected != actual:
            bad.append(f"{where}: expected {expected!r}, got {actual!r}")
        return bad
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if abs(float(expected) - float(actual)) > tol:
            bad.append(f"{where}: expected {expected}, got {actual} (±{tol})")
        return bad
    if expected != actual:
        bad.append(f"{where}: expected {expected!r}, got {actual!r}")
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("state")
    ap.add_argument("--expect", default=None)
    ap.add_argument("--baseline", default=None)
    ap.add_argument("--case", default=None)
    ap.add_argument("--name", default="checkpoint")
    ap.add_argument("--tol", type=float, default=TOL_DEFAULT)
    ap.add_argument("--get", default=None, help="print one value instead of comparing")
    args = ap.parse_args()

    state = load(args.state)

    if args.get:
        print(json.dumps(get(state, args.get)))
        return 0

    if args.expect is not None:
        expected = json.loads(args.expect)
    elif args.baseline:
        base = load(args.baseline)
        if args.case is None:
            print("FAIL  --baseline needs --case", file=sys.stderr)
            return 2
        cases = base.get("checkpoints", base)
        if args.case not in cases:
            print(f"FAIL  {args.name}  baseline has no checkpoint {args.case}")
            return 1
        expected = cases[args.case]
    else:
        print("FAIL  --expect or --baseline is required", file=sys.stderr)
        return 2

    bad = compare(expected, state, args.tol)
    if bad:
        print(f"FAIL  {args.name}")
        for line in bad:
            print(f"      {line}")
        return 1
    print(f"PASS  {args.name}  ({json.dumps(expected, sort_keys=True)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
