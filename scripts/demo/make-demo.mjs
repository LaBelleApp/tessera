// make-demo.mjs — writes a realistic docs/data.json without touching GitHub, so the
// site renders out of the box. Same shape the real aggregator produces.
//   npm run demo
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GENERATED = new Date(Date.now() - 2 * 864e5);            // assembled 2 days ago
const at = days => new Date(GENERATED.getTime() - days * 864e5).toISOString();

// [id, name, type, status, owner, updatedDays, summary, whenToUse, uses[], partOf]
const F = [
  ['flutter-core','Flutter Core','framework','maintained','Platform',4,'In-house Flutter framework: architecture, conventions and shared building blocks for every project.','Mandatory foundation of any new Flutter project.',[],null],
  ['ui-kit','UI Kit','package','maintained','Platform',6,'Reusable component library and design system.','So you never rebuild buttons, forms and themes from scratch.',['flutter-core'],'flutter-core'],
  ['auth-module','Auth Module','package','working','Platform',18,'Authentication (OAuth, biometrics, sessions).','Whenever a project needs login.',['flutter-core'],'flutter-core'],
  ['analytics-kit','Analytics Kit','package','working','Data',22,'Unified analytics wrapper (events, funnels).','To track usage without coupling code to vendor SDKs.',['flutter-core'],'flutter-core'],
  ['i18n-kit','i18n Kit','package','testing','Platform',9,'Translations and locale formatting.','Multi-language projects.',['flutter-core'],'flutter-core'],
  ['deploy-cli','Deploy CLI','cli','maintained','DevOps',3,'Deployment CLI (build, signing, stores, CI).','Every time you ship an app.',[],null],
  ['scaffold-cli','Scaffold CLI','cli','working','Platform',11,'Generates a framework-compliant project skeleton.','Start a project in 30s instead of a day.',['flutter-core'],null],
  ['shot-tool','Shot Tool','tool','working','Mobile',27,'Automated multi-device store screenshots.','Before an App Store / Play Store submission.',[],null],
  ['db-migrate','DB Migrate','cli','in-dev','Backend',5,'Database schema migration tool.','When a project evolves its data model.',[],null],
  ['perf-lint','Perf Lint','tool','testing','Platform',14,'Static Flutter performance analysis (rebuilds, jank).','Performance audit before delivery.',['flutter-core'],null],
  ['doc-gen','Doc Gen','skill','working','DX',12,"Generates a repo's documentation from its code.",'Document an existing project fast.',[],null],
  ['tessera-manifest-gen','Tessera Manifest Gen','skill','in-dev','DX',1,'Generates the tessera.yaml manifest for a repo.','Run it when adding or updating a tile on this mosaic.',['scaffold-cli'],null],
  ['code-review','Code Review','skill','working','DX',8,'Automated code review against house conventions.','On every PR before merge.',['flutter-core'],null],
  ['widget-gen','Widget Gen','skill','testing','Mobile',16,'Generates a Flutter widget matching the design system.','Prototype a screen quickly.',['ui-kit'],null],
  ['changelog-bot','Changelog Bot','skill','working','DX',20,'Writes a changelog from commits.','At every release.',[],null],
  ['pr-summary','PR Summary','skill','fragment','DX',2,'Summarizes a PR for reviewers.','Speed up review — idea, not built yet.',[],null],
  ['test-gen','Test Gen','skill','in-dev','DX',7,'Generates unit / widget tests.','Cover legacy code.',['flutter-core'],null],
  ['tessera','Tessera','site','in-dev','DX',0,'This very site: a living mosaic of tools, projects and skills.','Onboarding, discovery, internal showcase.',['tessera-manifest-gen'],null],
  ['ops-dashboard','Ops Dashboard','internal-app','working','DevOps',13,'Project and CI status dashboard.',"Bird's-eye view of delivery health.",['deploy-cli'],null],
  ['banking-app','Banking App','client-app','maintained','Squad Alpha',10,'Mobile account-management app (fintech client).','Reference for a fintech project.',['flutter-core','deploy-cli','auth-module'],null],
  ['retail-app','Retail App','client-app','maintained','Squad Beta',15,'Mobile e-commerce app (retail client).','Reference for catalog + cart.',['flutter-core','ui-kit','analytics-kit'],null],
  ['health-app','Health App','client-app','working','Squad Alpha',21,'Patient-tracking app (health client).','Reference for sensitive data + strong auth.',['flutter-core','auth-module','i18n-kit'],null],
  ['logistics-app','Logistics App','client-app','working','Squad Gamma',19,'Fleet and delivery tracking app.','Reference for maps + real-time.',['flutter-core','deploy-cli'],null],
  ['realestate-app','Real Estate App','client-app','maintained','Squad Beta',24,'Property management app.','Reference for heavy forms.',['flutter-core','ui-kit'],null],
  ['resto-app','Resto App','client-app','archived','Squad Gamma',210,'Restaurant ordering app (closed / archived).','Reference source, project closed.',['flutter-core'],null],
  ['fitness-app','Fitness App','client-app','working','Squad Beta',17,'Sports coaching app.','Reference for gamification.',['flutter-core','analytics-kit'],null],
  ['edu-app','Edu App','client-app','in-dev','Squad Alpha',3,'Mobile learning platform.','In progress — reference for offline content.',['flutter-core','scaffold-cli','i18n-kit'],null],
  ['media-app','Media App','client-app','in-dev','Squad Gamma',6,'Media streaming app.','In progress — reference for video player.',['flutter-core','ui-kit'],null],
  ['energy-app','Energy App','client-app','testing','Squad Alpha',8,'Energy-consumption monitoring app.','In testing — reference for IoT.',['flutter-core','deploy-cli','analytics-kit'],null],
  ['ai-codegen','AI Codegen','experiment','fragment','R&D',2,'Generate full screens from a description.','No clear product goal yet.',[],null],
  ['voice-ui','Voice UI','experiment','testing','R&D',9,'Navigate an app with voice commands.','Accessibility.',['ui-kit'],null],
  ['design-tokens','Design Tokens','experiment','fragment','R&D',30,'Design tokens synced Figma <-> code.','Unify design and dev.',['ui-kit'],null],
  // a brand-new repo with an empty tessera.yaml → onboarded as a bare fragment
  ['secret-project','Secret Project','experiment','fragment','unassigned',0,'','',[],null],
];

// a few demo tags so the Tags column / tag-search is visible
const TAGS = {
  'flutter-core':['flutter','core'], 'ui-kit':['flutter','design-system'], 'auth-module':['auth','security'],
  'analytics-kit':['analytics'], 'i18n-kit':['i18n'], 'deploy-cli':['ci','devops'], 'tessera':['catalog','onboarding'],
  'banking-app':['fintech','mobile'], 'retail-app':['ecommerce','mobile'], 'health-app':['health','mobile'],
  'fitness-app':['health','mobile'], 'media-app':['media','mobile'], 'energy-app':['iot','mobile'],
  'voice-ui':['accessibility'], 'design-tokens':['design','figma'],
};

// a few have docs → the completeness score varies across tiles
const DOCS = new Set(['flutter-core','ui-kit','auth-module','deploy-cli','tessera','banking-app','retail-app','scaffold-cli']);

const tesserae = F.map(([id,name,type,status,owner,d,summary,whenToUse,uses,partOf]) => ({
  id, name, type, status, owner, summary, whenToUse,
  uses, partOf, tags: TAGS[id] || [],
  links: { repo: `https://github.com/my-org/${id}`, doc: DOCS.has(id) ? `https://docs.my-org.dev/${id}` : null },
  updatedAt: at(d), isFragment: status === 'fragment',
}));

const out = {
  generatedAt: GENERATED.toISOString(),
  stats: { mode: 'demo', reposScanned: 34, tesserae: tesserae.filter(t => !t.isFragment).length, fragments: tesserae.filter(t => t.isFragment).length },
  tesserae,
};

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/data.json'), JSON.stringify(out, null, 2));
fs.copyFileSync(path.join(ROOT, 'taxonomy.json'), path.join(ROOT, 'docs/taxonomy.json'));
console.log(`Wrote docs/data.json (${tesserae.length} tesserae) + docs/taxonomy.json`);
