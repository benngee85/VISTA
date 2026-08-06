# VISTA Analysis Against NISP Version 17

**Baseline:** NISP Version 17, 02 April 2026  
**Project evidence:** VISTA repository and sovereign classification closure 236  
**Status:** Architecture analysis and engineering recommendation; not a conformity certification

## 1. Executive conclusion

VISTA should not be decomposed into one container per NISP standard. NISP defines interoperability standards and service areas, not a prescribed deployment topology. The appropriate architecture is to use NISP service boundaries to determine where independently governed, replaceable and federatable services are required.

Two concurrent workstreams are recommended:

1. **Standardise in place**: stabilise externally visible contracts, identity, metadata, geospatial exchange, audit events, time, naming and configuration without first changing the application topology.
2. **Extract governed platform services**: move identity, DNS/time, egress mediation, data acquisition, cache/broker, semantic catalogue, observability and policy enforcement into separately managed containers or container groups.

The VISTA user interface and domain visualisation logic may remain a cohesive application. Foundational and federation-facing functions should not remain embedded within it.

## 2. Evidence baseline

The current Compose baseline includes a VISTA application, relay, Valkey and Valkey REST adapter. It already has layered environment authority, node/site/federation identifiers, local model endpoint settings and a deployment-profile mechanism. The sovereign classification closure reports 632 actionable runtime evidence partitions, zero unreviewed actionable hosts and zero actionable direct AI-provider endpoints.

The closure identifies the dependency surface; it does not demonstrate NISP conformance or sovereign runtime control.

## 3. NISP interpretation rules

- **Mandatory** means mandatory only when the relevant NISP profile or service context is selected; it is not a universal requirement for every VISTA deployment.
- **Candidate** standards should be tracked as likely migration targets, not asserted as current compliance obligations.
- NISP service areas are used here as architecture decomposition guidance.
- FMN Spiral 5 remains the intended federation baseline; NISP 17 also contains Spiral 6 items and candidates that should be isolated behind replaceable interfaces.
- NISP does not prescribe Docker Compose, Kubernetes or a specific container count.

## 4. Standardise now, without major decomposition

### 4.1 API contracts

Adopt a single API profile for all new and refactored VISTA interfaces:

- RFC 9110 HTTP Semantics — NISP `STD-00403`, Mandatory.
- RFC 9112 HTTP/1.1 — `STD-00405`, Mandatory.
- JSON RFC 8259 — `STD-00390`, Mandatory.
- OpenAPI 3.1 — `STD-01004`, Mandatory.
- URI syntax RFC 3986 — `STD-00222`, Mandatory.
- REST binding profile — NISP profile `PFL-00087`.

Implementation actions:

- place all externally consumed APIs under versioned paths;
- publish OpenAPI 3.1 documents from source;
- define canonical media types, pagination, filtering, error structure and idempotency rules;
- separate public, federation, administration and internal APIs;
- prohibit undocumented direct browser calls to external providers.

### 4.2 Identity and token interfaces

Use current mandatory NISP standards as the stable external contract:

- OAuth 2.0 RFC 6749 — `STD-00334`;
- bearer token usage RFC 6750 — `STD-00335`;
- JWT RFC 7519 — `STD-00361`;
- JWT access-token profile RFC 9068 — `STD-00402`;
- OIDC Core — `STD-01610`;
- OIDC Discovery — `STD-01574`;
- OIDC Dynamic Registration — `STD-01575`.

Track, but do not make the initial architecture dependent upon, the candidate NATO ICAM family `STD-01910` to `STD-01916`, candidate SCIM `STD-01884` to `STD-01886`, and candidate NATO OAuth/OIDC/JWT profiles.

### 4.3 TLS and certificate handling

- TLS 1.3 RFC 8446 — `STD-00394`, Mandatory.
- Maintain explicit certificate profiles, trust anchors, hostname validation and rotation policy.
- Remove insecure HTTP exceptions from production/federation profiles.
- Use mTLS for service-to-service trust where identity and information release decisions depend on the calling workload.

### 4.4 Naming and time

- DNS concepts and protocol: RFC 1034 and RFC 1035 — `STD-00109`, `STD-00110`, Mandatory.
- NTPv4 RFC 5905 — `STD-00311`, Mandatory.
- Network Time Security RFC 8915 — `STD-00918`, Mandatory.

Standardise node identity, service names, SRV records, certificate names, timestamps, clock-quality status and failure behaviour before moving services.

### 4.5 Geospatial interfaces

VISTA has substantial map, tile, imagery and geospatial dependencies. Standardise federation-facing output around:

- FMN Spiral 5 SIP for WMS/WMTS — `STD-00081`, Mandatory;
- OGC WMS — `STD-01049`, Mandatory;
- OGC WMTS — `STD-01053`, Mandatory;
- DGIWG WMS and WMTS — `STD-01784`, `STD-01785`, Mandatory;
- GeoPackage 1.4 — `STD-01895`, Mandatory;
- DGIWG GeoPackage profile — `STD-01786`, Mandatory.

Use candidate OGC API Features and Tiles only behind adapters until the selected federation profile formally adopts them.

### 4.6 Metadata and information binding

- SIP for Binding Metadata to HTTP Messages — `STD-00073`, Mandatory.
- ADatP-4778.2 metadata binding to data objects — `STD-00754`, Mandatory.
- Track candidate IEPD `STD-01879`, candidate federated data catalogue `STD-01909`, and candidate DCAT 3 `STD-01955`.

Add explicit source, provenance, reliability, quality, security label, dissemination, licence, freshness and transformation metadata to VISTA information objects. Preserve these as RDF/JSON-LD internally where useful, but do not claim RDF, OWL, SPARQL or SHACL as NISP 17 mandates unless a selected profile explicitly requires them.

## 5. Recommended service decomposition

### 5.1 Extract immediately

#### A. Foundation services plane

Separate deployment unit containing or integrating:

- DNS;
- secure time distribution;
- PKI and certificate lifecycle integration;
- identity directory and OIDC/OAuth provider;
- secrets retrieval and workload identity.

NISP service-area alignment:

- Domain Name Services `CR-1080`;
- Distributed Time Services `CR-1079`;
- Infrastructure CIS Security Services `CR-1039`;
- Security Token Services `CR-1122`;
- Policy Enforcement Point Services `CR-1114`.

This should not share the VISTA application container or lifecycle.

#### B. Controlled egress and acquisition plane

Move all external feeds, scraping, API calls and media acquisition behind one controlled service boundary:

- provider adapters;
- outbound allow-listing;
- rate limiting and circuit breaking;
- provenance capture;
- schema validation;
- quarantine;
- caching and replay;
- disconnected-operation packages.

NISP alignment:

- Proxying Services `CR-1117`;
- Data Transfer Services `CR-1074`;
- Information Aggregation Services `CR-1084`;
- Mediation Services `CR-1093`;
- Protocol Transformation Services `CR-1116`;
- Pipeline Processing Services `CR-1165`.

The current VISTA relay is the natural starting point, but it should evolve into a governed acquisition gateway rather than remain a specialised AIS/WebSocket helper.

#### C. Semantic information and catalogue plane

Deploy separately:

- Apache Jena/Fuseki for RDF storage, SPARQL, federation and controlled reasoning;
- TopBraid EDG for ontology, taxonomy, metadata and lifecycle governance;
- SHACL validation services;
- catalogue and provenance APIs;
- immutable foundation ontology plus bridge/domain/application modules.

NISP alignment:

- Metadata Repository Services `CR-1100`;
- Data Management Services `CR-1140`;
- Data Discovery Services `CR-1141`;
- Data Access Services `CR-1142`;
- Information Discovery Services `CR-1086`.

This plane must not be embedded into the front-end application or Valkey cache.

#### D. Observability and audit plane

Deploy logging, metrics, traces, audit events and alerting independently:

- infrastructure logging `CR-1042`;
- infrastructure monitoring `CR-1044`;
- platform logging `CR-1107`;
- platform monitoring `CR-1109`;
- service-management-and-control interfaces.

Application logs are evidence; the application container should not be the system of record for them.

### 5.2 Extract methodically

#### E. Cache, message and workflow services

Valkey and its REST adapter are already separate, but the REST adapter is a project-specific compatibility boundary. Split responsibilities over time:

- cache service;
- durable message broker/queue;
- event stream;
- workflow/orchestration;
- replay store.

NISP alignment:

- Caching Services `CR-1069`;
- Message Brokering `CR-1094`;
- Message Caching `CR-1095`;
- Message Proxying `CR-1096`;
- Message Queueing `CR-1097`;
- Message Routing `CR-1098`;
- Orchestration Services `CR-1104`.

Do not use Valkey as the authoritative semantic store, durable audit store or long-term event archive.

#### F. Geospatial services

Move tile, map, feature, coverage and catalogue interfaces into a geospatial service group. The VISTA application should consume standard WMS/WMTS/GeoPackage or an internal API gateway, not provider-specific map APIs directly.

#### G. AI inference and embedding services

Keep LM Studio/Qwen/nomic as the laboratory implementation but define model services as independent workloads:

- inference gateway;
- embedding service;
- model registry and provenance;
- prompt/tool policy enforcement;
- content and release controls;
- audit and evaluation service.

NISP 17 contains Machine Learning Services `CR-1050` and computational-governance-related service areas, but does not by itself establish an adequate AI assurance profile. Treat this as a VISTA application profile layered over NISP service boundaries.

### 5.3 Keep cohesive for now

Retain in the primary VISTA application:

- browser presentation;
- operator workspace;
- visual composition;
- application-specific query orchestration;
- non-authoritative user preferences;
- domain widgets with no independent federation contract.

Extract a feature only when it has an independent lifecycle, trust boundary, scaling characteristic, data authority, federation interface or failure domain.

## 6. Target container groups

A practical near-term Compose topology is:

1. `vista-ui-api` — presentation and application orchestration.
2. `vista-acquisition-gateway` — all external egress and source adapters.
3. `vista-relay` — streaming/WebSocket ingestion, later merged into or governed by the acquisition plane.
4. `vista-cache` — Valkey.
5. `vista-cache-api` — temporary compatibility adapter; remove once services use a governed cache client or standard service API.
6. `vista-broker` — durable queue/event transport.
7. `vista-fuseki` — RDF and SPARQL data plane.
8. `vista-topbraid` — semantic governance plane.
9. `vista-shacl-validator` — contextual validation worker/API.
10. `vista-identity` — FreeIPA plus an OIDC/OAuth bridge/provider, or an enterprise ICAM integration.
11. `vista-dns-time` — BIND and Chrony/NTS integration; preferably separate instances in production rather than one container.
12. `vista-policy` — PDP/PEP and information-release policy services.
13. `vista-observability` — logs, metrics, traces and audit collection.
14. `vista-geospatial` — WMS/WMTS/GeoPackage façade and caches.
15. `vista-llm-gateway`, `vista-inference`, `vista-embedding` — independently controlled AI services.

For production, combine only services with the same authority, trust boundary and lifecycle. DNS, time, identity and PKI should normally be redundant platform instances, not sidecars in the VISTA application stack.

## 7. Concurrent analysis and delivery method

### Workstream A — NISP applicability profile

Create a VISTA NISP profile rather than treating the full catalogue as applicable.

For every selected service capability record:

- NISP service-area ID;
- selected NISP profile;
- standard ID and obligation;
- applicability condition;
- current implementation;
- conformance evidence;
- gap;
- decision owner;
- target release;
- exception and residual risk.

### Workstream B — runtime dependency remediation

Continue with the 632 runtime partitions, grouped by service family. For each family select retain, relay, cache, mirror, replace, disable or localise. Link each decision to the NISP service area and interface profile.

### Workstream C — service-boundary extraction

Use an architecture decision record and strangler pattern:

1. freeze the existing interface;
2. publish an OpenAPI contract;
3. place an adapter in front of the embedded implementation;
4. create a separate container implementing the contract;
5. migrate callers;
6. add conformance and failure tests;
7. disable the embedded implementation;
8. retain rollback capability until operational acceptance.

### Workstream D — machine-readable assurance

Represent the applicability profile in RDF/JSON-LD and validate it with SHACL. Keep NISP identifiers as external controlled identifiers; do not copy or modify the NISP semantic source. Use bridge mappings from VISTA services and deployments to NISP service areas, profiles and standards.

### Workstream E — architecture evaluation

Evaluate each extraction increment using ISO/IEC/IEEE 42030 and ATAM-style scenarios. Required scenarios should include:

- federation onboarding;
- provider outage;
- DNS/time loss;
- certificate expiry;
- disconnected operation;
- stale-data handling;
- compromised source;
- cross-domain release restriction;
- model substitution;
- high-latency/low-bandwidth operation;
- rollback and evidence reconstruction.

## 8. Prioritised roadmap

### 0–30 days

- commit and govern the closure tooling and assurance artefacts;
- create the VISTA NISP applicability matrix;
- standardise OpenAPI, HTTP, JSON, URI and error contracts;
- establish DNS/time/identity naming conventions;
- define deployment profiles and egress policy;
- prohibit new direct provider calls outside the acquisition gateway;
- add source/provenance/security metadata envelope.

### 30–90 days

- extract the acquisition gateway;
- deploy identity/OIDC and certificate integration;
- deploy central observability;
- introduce broker/event transport;
- stand up Fuseki, TopBraid and SHACL services;
- introduce WMS/WMTS/GeoPackage geospatial façade;
- implement policy decision/enforcement boundaries.

### 90–180 days

- migrate remaining direct provider integrations;
- establish disconnected data packages and replay;
- federate identity and catalogue interfaces;
- implement NISP/FM N conformance test suites;
- separate AI gateway, inference and embeddings;
- evaluate production orchestration and high availability beyond Compose.

## 9. Decisions requiring authority

1. Which NISP/FM N profile combination is the formal VISTA target for each deployment profile?
2. Which candidate NISP 17 standards may be adopted early?
3. Is FreeIPA the authoritative identity source or an implementation behind a federation ICAM boundary?
4. Which information labels and release rules apply to OSINT-derived products?
5. Which external sources may be retained in sovereign-connected and coalition profiles?
6. Which services require cross-domain guards rather than ordinary API gateways?
7. What is the accepted orchestration baseline after laboratory Compose?

## 10. Recommended next artefacts

- `docs/architecture/nisp17-applicability-profile.md`
- `docs/architecture/nisp17-service-boundary-map.md`
- `docs/architecture/runtime-remediation-roadmap.md`
- `architecture/nisp17-applicability-profile.jsonld`
- `architecture/shacl/nisp17-applicability.shacl.ttl`
- `architecture/adr/ADR-NNN-acquisition-gateway.md`
- `architecture/adr/ADR-NNN-semantic-platform-separation.md`
- `architecture/adr/ADR-NNN-foundation-services-plane.md`

## 11. Overall recommendation

Proceed concurrently. Do not wait for all 632 runtime dependencies to be remediated before beginning NISP standardisation. Standardise contracts and metadata immediately, while extracting the highest-risk trust and lifecycle boundaries first: identity, DNS/time, egress/acquisition, semantic governance, observability and policy enforcement.

The resulting architecture remains ontology-centric: NISP governs interoperability applicability; the immutable foundation ontology governs semantic meaning; bridge modules connect VISTA capabilities and deployments to NISP service areas and standards; SHACL validates the selected deployment context.
