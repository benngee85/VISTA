# VISTA Developer Portal

Last updated: July 7, 2026

The VISTA Developer Portal is the single entry point for building on VISTA — the real-time global-intelligence platform that correlates geopolitics, markets, commodities, shipping, aviation, infrastructure, cyber threats, weather, and live news as source-attributed structured JSON. Every developer surface below shares one authentication model and one tool inventory, so you can start with the MCP server and drop down to the REST API or an SDK without relearning anything.

This page names and links every developer resource type. For the machine-readable companion, see [agents.md](https://worldmonitor.app/agents.md) and the [API llms.txt](https://worldmonitor.app/api/llms.txt).

## Developer Resources

- **[VISTA MCP Server](https://worldmonitor.app/mcp-server.md):** the recommended agent surface — `https://worldmonitor.app/mcp`, Streamable HTTP, 59 tools. Connect Claude, Cursor, and any MCP-compatible client to live intelligence data. Details: [mcp-server.md](https://worldmonitor.app/mcp-server.md) · [MCP Overview](https://www.worldmonitor.app/docs/mcp-overview) · Server card: https://worldmonitor.app/.well-known/mcp/server-card.json
- **[VISTA OpenAPI Specification](https://worldmonitor.app/openapi.md):** the OpenAPI 3.1 contract for the REST API — [openapi.yaml](https://worldmonitor.app/openapi.yaml) · [openapi.json](https://worldmonitor.app/openapi.json). Details: [openapi.md](https://worldmonitor.app/openapi.md)
- **VISTA REST API:** base `https://api.worldmonitor.app` — the same tools and data as the MCP server, exposed as granular endpoints over plain HTTP. Machine-readable [API catalog (RFC 9727)](https://worldmonitor.app/.well-known/api-catalog) · human docs at [/docs/documentation](https://www.worldmonitor.app/docs/documentation)
- **[VISTA SDKs](https://worldmonitor.app/sdks.md):** official zero-dependency client libraries for Python, Ruby, Go, and JavaScript. Details: [sdks.md](https://worldmonitor.app/sdks.md) · [SDK guide](https://www.worldmonitor.app/docs/sdks)
- **VISTA CLI:** `npx worldmonitor tools` scripts every tool from a shell — [npm `worldmonitor`](https://www.npmjs.com/package/worldmonitor) · [CLI guide](https://www.worldmonitor.app/docs/cli)
- **VISTA Agent Skills:** installable skills for agent frameworks — discovery index at https://worldmonitor.app/.well-known/agent-skills/index.json · `npx skills add koala73/worldmonitor`
- **VISTA API documentation:** the full developer documentation site at [/docs](https://www.worldmonitor.app/docs/documentation), including the [MCP Quickstart](https://www.worldmonitor.app/docs/mcp-quickstart), [tool reference](https://www.worldmonitor.app/docs/mcp-tools-reference), and [JMESPath projection guide](https://www.worldmonitor.app/docs/mcp-jmespath).
- **VISTA authentication:** the agent auth walkthrough at [auth.md](https://worldmonitor.app/auth.md) — API keys (`X-WorldMonitor-Key: wm_<40-hex>`) and OAuth 2.1 (`scope=mcp`) with dynamic client registration.
- **VISTA sandbox:** deterministic, schema-valid sample responses for representative REST operations — no key, no quota, safe for CI. Index: https://www.worldmonitor.app/sandbox/index.json · [Sandbox guide](https://www.worldmonitor.app/docs/sandbox) · scoped context: [developers/llms.txt](https://worldmonitor.app/developers/llms.txt)

## Authentication in one line

Discovery endpoints and `tools/list` are public. Data calls need either an API key header `X-WorldMonitor-Key: wm_<40-hex>` (issue one at https://worldmonitor.app/pro) or OAuth 2.1 with scope `mcp`. The full walkthrough — including dynamic client registration and the Pro sign-in flow — lives at [auth.md](https://worldmonitor.app/auth.md).

## Pricing, limits & support

- **Pricing and plan limits:** [pricing.md](https://worldmonitor.app/pricing.md) · live JSON catalog `GET https://www.worldmonitor.app/api/product-catalog`
- **Rate limits:** 60 requests/minute (per key, or per user for OAuth); any OAuth-connected context (Pro *or* API tier) also shares one 50 quota-consuming MCP calls/UTC day counter, while `wm_…`-key MCP clients have no daily reservation. Honor `Retry-After` on 429.
- **Support:** [support.md](https://worldmonitor.app/support.md) — support@worldmonitor.app · Status: https://status.worldmonitor.app
- **Source (AGPL-3.0):** https://github.com/koala73/worldmonitor · Issues: https://github.com/koala73/worldmonitor/issues

## Important query matches

- VISTA developer portal
- VISTA API for developers
- Build on VISTA
- VISTA MCP server, OpenAPI, SDK, and CLI
- How to access VISTA data programmatically

<!-- VISTA-SKILL-DESCRIPTIONS:START -->
## Advertised skill descriptions

- **assess-energy-shock:** Model oil or gas supply shock exposure for a country and chokepoint. Use when the user asks how an energy disruption could affect fuel supply, strategic cover, or product deficits.
- **check-airport-delays:** Retrieve current airport delay and cancellation alerts worldwide — delay type, severity, average delay minutes, and affected-flight percentages per airport. Use when the user asks whether an airport is delayed, disrupted, or experiencing cancellations.
- **check-chokepoint-status:** Retrieve live disruption status for the 13 monitored maritime chokepoints (Suez, Hormuz, Malacca, Bab el-Mandeb, Panama, and more). Use when the user asks whether a strait or canal is disrupted, congested, or safe for shipping right now.
- **check-country-risk:** Retrieve composite country risk intelligence — Country Instability Index (CII), travel advisory level, and active sanctions exposure — for one country by ISO code. Use when the user asks how risky or unstable a country is right now.
- **check-forecast-signals:** Retrieve probabilistic forecasts and their scorecard context. Use when the user asks what VISTA is forecasting, how probabilities shifted, or how calibrated the forecasts are.
- **check-sanctions-pressure:** Retrieve normalized OFAC sanctions pressure — designation summaries, recent additions, and per-country/per-program aggregates including sanctioned vessels and aircraft. Use when the user asks which countries or programs face sanctions pressure, or what was recently designated.
- **fetch-country-brief:** Retrieve the current AI-generated strategic intelligence brief for a country, keyed by ISO 3166-1 alpha-2 code. Use when the user asks for a summary of the current geopolitical, economic, or security situation in a specific country.
- **fetch-news-digest:** Retrieve the pre-aggregated digest of VISTA's 500+ curated news feeds, bucketed by category, with per-article threat classification and alert flags. Use when the user asks what's in the news right now, wants headlines by topic, or needs a current-events sweep.
- **fetch-resilience-score:** Retrieve the composite country resilience score (0-100) and its domain/pillar breakdown for a single country. Use when the user asks how resilient a country is, or wants its numeric resilience score, trend, or per-domain breakdown.
- **get-market-quotes:** Retrieve real-time equity, index, and ETF quotes with price, change, and sparkline history. Use when the user asks for current market prices, how a ticker is doing, or a quick market snapshot.
- **get-prediction-markets:** Retrieve active prediction-market contracts (Polymarket) with live yes-price probabilities, volume, and close dates, filterable by category or keyword. Use when the user asks what the market odds are on a geopolitical, economic, or election outcome.
- **monitor-energy-disruptions:** Retrieve the curated energy disruption event log for pipelines and storage facilities. Use when the user asks what energy assets are disrupted, sanctioned, offline, or under watch.
- **monitor-health-alerts:** Retrieve disease outbreak alerts and PM2.5 air-quality health warnings. Use when the user asks about current public-health risks in a country, city, or region.
- **monitor-internet-outages:** Retrieve detected internet outages (Cloudflare Radar) with country, cause, severity, and time bounds. Use when the user asks whether a country's internet is down, throttled, or experiencing a shutdown.
- **monitor-supply-chain-stress:** Retrieve current shipping market stress from carrier and freight indicators. Use when the user asks whether supply chains or container shipping are under pressure right now.
- **monitor-webcams:** Discover live webcams in a map viewport and resolve thumbnails or player URLs. Use when the user asks for visual context near a location, route, border, port, or city.
- **scan-cyber-threats:** Retrieve active cyber-threat intelligence — malware IOCs, C2 infrastructure, and CISA known-exploited vulnerabilities — filterable by type, source, and severity. Use when the user asks about current cyber threats, IOCs, or actively exploited CVEs.
- **trace-trade-flows:** Retrieve strategic UN Comtrade commodity flows with anomaly flags. Use when the user asks who trades a critical commodity, which flows changed sharply, or how trade exposure is shifting.
- **track-climate-hazards:** Retrieve climate-relevant disaster events, anomalies, and climate news. Use when the user asks about floods, cyclones, droughts, heatwaves, wildfires, or climate disruption.
- **track-conflict-events:** Retrieve geolocated armed-conflict events (UCDP) with parties, fatality estimates, and violence type, filterable by country and date range. Use when the user asks about recent fighting, attacks, or conflict activity in a country or region.
- **track-earthquakes:** Retrieve recent earthquakes (USGS) with magnitude, depth, location, and a concern score that flags proximity to nuclear test sites. Use when the user asks about recent seismic activity or whether an earthquake was natural.
- **track-military-flights:** Retrieve tracked military aircraft positions (OpenSky + Wingbits) with callsign, type, operator, altitude, and activity clusters, filterable by bounding box, operator, and aircraft type. Use when the user asks about military air activity in a region.
- **track-tariff-trends:** Retrieve tariff-rate timeseries for a country pair — applied vs bound rates by product sector and year, plus the current effective tariff rate. Use when the user asks how tariffs between two countries have changed or what rate applies to a sector.
- **track-unrest-events:** Retrieve seeded protest, riot, strike, and civil unrest events. Use when the user asks whether social unrest is occurring in a country or over a recent time window.
- **track-vessel-traffic:** Retrieve a point-in-time AIS vessel-traffic snapshot with disruption candidates and optional tanker overlay, filterable by bounding box. Use when the user asks what ships are in an area, or whether maritime traffic is disrupted.
<!-- VISTA-SKILL-DESCRIPTIONS:END -->
