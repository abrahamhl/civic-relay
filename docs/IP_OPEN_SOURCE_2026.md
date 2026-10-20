# Open-source, trademark, safety and secrets strategy

The original `civic-relay` repo is published under **MIT**. That is a permissive open-source grant; it allows commercial copying and forks when its conditions are met. Merely changing future LICENSE terms does not automatically revoke rights under older MIT versions. There is no honest "open source but impossible to copy" license.

**Recommendation for this milestone:** preserve MIT until a legal/licensing review. Do not automatically relicense user contributions or code derived from dependencies. Audit copyright provenance, NOTICE and dependency licenses with automated tooling before publication.

**Protectable value:** a distinctive Civic Relay name/logo could be protected through trademark registration where available, separate from software copyright. Check availability and filing jurisdictions before using registration symbols. Proprietary services, deployments, operator partnerships, support/SLAs, datasets and hardware can remain separately licensed so long as third-party/open-source obligations are respected. EU public-grant conditions may require exploitation/access commitments, to be negotiated in a consortium agreement.

**Secret hygiene:** credentials only in deployment secret stores (not `NEXT_PUBLIC_*`, frontend bundles, demos, fixtures, PR comments). Maintain `.env.example` without values, automatic secret scanning and dependency checks. Rotate any credential ever exposed in a public commit history; deleting it from HEAD is not enough.

**Privacy:** strictly no background location harvesting, phone scanning or automatic upload of sensitive citizen messages. Opt-in coarse location, defined retention, data minimisation and data subject rights must be addressed before a real pilot. Offline copies may survive after users expect deletion, requiring explicit UX and expiry semantics.

**Security marketing:** neither MIT nor a CSP header establishes ENS, GDPR, EUCCS, NIS2 or mission-critical certification. Public safety operation would require an independent verification programme and liability allocation.

**Contributor readiness:** DCO or CLA choice, security contact using a real verified inbox, signed release tags, SBOM, and provenance reports. The current `SECURITY.txt` contains a fictitious `.example.com` email; never market it as a functional security reporting mailbox.
