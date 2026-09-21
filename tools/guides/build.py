"""Regenerates every page under public/guides/. See README.md."""
import subprocess, sys, pathlib

HERE = pathlib.Path(__file__).parent
for name in ["g1", "g2", "g3", "g4", "g5", "hub", "about"]:
    result = subprocess.run([sys.executable, f"{name}.py"], cwd=HERE, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout, result.stderr)
        sys.exit(f"{name}.py failed")
    print(result.stdout.strip())
