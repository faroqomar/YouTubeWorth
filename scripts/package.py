"""Deterministic allowlisted source package. Does not include this device's credential."""
from pathlib import Path
import zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
ROOT_FILES=['README.md','VERIFICATION.md','AGENTS.md','.impeccable.md','.gitignore','package.json','requirements.lock','classifier-config.json','server.mjs','laya-worker.py','worth_analysis.py','setup.html','setup.js','start.command','install-service.mjs','download-runtime.mjs']
ALLOWED={'.md','.json','.js','.mjs','.py','.css','.html'}
files=[ROOT/f for f in ROOT_FILES]
for directory in ['extension','lib','docs','scripts','test','evaluation']:
 files.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and not p.is_symlink() and p.suffix in ALLOWED and p.name not in ['local-config.js','calibration-experiment.json'] and '__pycache__' not in p.parts)
# Curated, reviewed public UI captures only; never include the private preview directory.
for name in ['viewing-map.png','useful-only.png','settings.png','demo.gif','demo.mp4']:
 files.append(ROOT/'docs'/'media'/name)
secret=(ROOT/'.local-token').read_bytes().strip() if (ROOT/'.local-token').exists() else b''
target=ROOT/'YouTubeWorth.zip';entries={str(p.relative_to(ROOT)):p.read_bytes() for p in files}
entries['extension/local-config.js']=b"export const LOCAL_TOKEN = '';\n"
for name,content in entries.items():
 assert not any(part in name.split('/') for part in ['runtime','.venv','preview','__pycache__']),name
 assert not(secret and secret in content),f'Credential detected in {name}'
 assert not name.endswith(('.log','.txt','.safetensors')),name
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(entries.items()):
  info=zipfile.ZipInfo('YouTubeWorth/'+name,(2026,10,7,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o755 if name=='start.command' else 0o644)<<16;z.writestr(info,data)
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 assert z.read('YouTubeWorth/extension/local-config.js')==b"export const LOCAL_TOKEN = '';\n"
 assert any(n.startswith('YouTubeWorth/docs/') for n in z.namelist())
print(f'Packaged {len(entries)} allowlisted files; credentials/runtime/model/cache/private artifacts excluded. SHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
