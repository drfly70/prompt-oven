# Prompt Oven

Standalone project. Not the swim site. Not `drfly70/3rd`.

Drop a raw ask in. The oven mixes up to three techniques from a frozen catalog and returns one engineered variant. The source ask is never replaced.

## Run locally

```
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/

```
node --test
```

## Deploy (separate Vercel project)

1. vercel.com → Add New → Project → Import `drfly70/prompt-oven`
2. Root directory: repo root
3. Framework: Other
4. Output directory: `.` (from `vercel.json`)
5. Deploy

Do not import this into the `3rd` / south-bay-private-swim Vercel project.

## Policy

Catalog v0.1.0. Max 3 techniques. Token-change cap 0.4. Short asks bake nothing — the UI says so.
