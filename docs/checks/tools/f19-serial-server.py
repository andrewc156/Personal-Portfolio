import subprocess, sys, urllib.request, time, os, signal
from pathlib import Path
cwd, *args = sys.argv[1:]
cmd = [str(Path('node_modules/.bin/astro').resolve()),'preview' if args[0]!='DEV' else 'dev','--port','4321','--strictPort','--ignore-lock']
if args[0]=='DEV': args=args[1:]
server = subprocess.Popen(cmd,cwd=cwd,start_new_session=True, stdout=sys.stderr)
try:
    for _ in range(400):
        if server.poll() is not None: sys.exit(server.returncode or 1)
        try:
            with urllib.request.urlopen('http://localhost:4321/',timeout=1): break
        except OSError: time.sleep(.15)
    else: raise RuntimeError('server did not start')
    sys.exit(subprocess.run(args, env={**os.environ,'PW_BASE_URL':'http://localhost:4321'}).returncode)
finally:
    try: os.killpg(server.pid, signal.SIGTERM)
    except ProcessLookupError: pass
    server.wait(timeout=15)
