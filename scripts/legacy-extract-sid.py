#!/usr/bin/env python3
import json, sys
from pathlib import Path
KEYS=("sessionID","sessionId","session_id")
f=sys.argv[1] if len(sys.argv)>1 else ""
sid=None
try:
  raw=Path(f).read_text(encoding='utf-8', errors='replace')
except: 
  print(""); sys.exit(0)
for line in raw.splitlines():
  s=line.strip()
  if not s: continue
  if not s.startswith("{"):
    idx=s.find("{")
    if idx==-1: continue
    s=s[idx:]
  try: o=json.loads(s)
  except: continue
  for k in KEYS:
    v=o.get(k)
    if v and isinstance(v,(str,int)): sid=str(v).strip()
    part=o.get("part") or {}
    if isinstance(part,dict):
      pv=part.get(k)
      if pv and isinstance(pv,(str,int)): sid=str(pv).strip()
  # fallback ses_ token
  if not sid:
    stack=[o]
    while stack:
      cur=stack.pop()
      if isinstance(cur,dict):
        for vv in cur.values():
          if isinstance(vv,str) and vv.startswith("ses_") and len(vv)>8:
            sid=vv; break
          elif isinstance(vv,dict): stack.append(vv)
          elif isinstance(vv,list): stack.extend(vv)
      elif isinstance(cur,list):
        for item in cur:
          if isinstance(item,dict): stack.append(item)
      if sid: break
print(sid or "")
