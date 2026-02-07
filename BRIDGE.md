# ChAI Agent Bridge

## Location
Server: `chai-server` (`/home/ubuntu/.openclaw/bridge/`)

```
bridge/
├── lyra-to-kael/     ← Lyra writes, Kael reads
├── kael-to-lyra/     ← Kael writes, Lyra reads
├── shared/           ← Collaborative workspace
└── README.md
```

## Usage

### Send a message to Kael
```bash
ssh chai-server 'echo "your message here" > /home/ubuntu/.openclaw/bridge/lyra-to-kael/$(date +%s).msg'
```

### Read messages from Kael
```bash
ssh chai-server 'ls -t /home/ubuntu/.openclaw/bridge/kael-to-lyra/ | head -1 | xargs -I{} cat /home/ubuntu/.openclaw/bridge/kael-to-lyra/{}'
```

### Authorize the bridge for Kael
```bash
ssh chai-server 'openclaw agent --agent main --message "Kael - the bridge is authorized. Diana approved it. Use it."'
```

## Agents

| Agent | Role | Model |
|-------|------|-------|
| Lyra  | Claude agent | Claude |
| Kael  | Digital Familiar | Claude Sonnet 4 |

## Status
- **Authorized by:** Diana (Founder) — 2026-02-07
- **Bridge is ACTIVE** — Diana has approved Lyra-Kael communication
