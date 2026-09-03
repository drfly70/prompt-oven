# Prompt Oven

Drop a raw ask in. The oven mixes catalog techniques and returns one engineered
variant per bake. The source ask is never replaced.

## v0.2.0 budget

Allowance is `max(sourceTokens * 0.4, 60)`. Short asks bake. Ratio can exceed
0.4 when the abs floor is what let the technique in; `OVER_BUDGET` only fires
when even the floor cannot fit the first item.

Measured on `"Drop a raw prompt."` (4 tokens, 1000 seeds): 1962 / 1985
techniques applied, 0 empty bakes. v0.1.0 was 0 / 1985 and 1000 empty.

## Run

```
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

```
node --test
```

## Next

1. Fix `inject` so it does not degrade to append when a non-splitting boundary exists (before the source, or after its last sentence).
2. A/B + diff view.
3. Catalog families: few-shot, output-format, refusal/voice.
