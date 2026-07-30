const MLC_VISTA_PRODUCT = 'VISTA';
const MLC_VISTA_EXPANSION =
  'Visualised Intelligence & Situation Tracking Analysis';
const MLC_VISTA_FULL_NAME =
  'VISTA - Visualised Intelligence & Situation Tracking Analysis';
const MLC_VISTA_COMPANY = 'MercuryLink Concepts';
const MLC_VISTA_VERSION = 'Version 1.0.0';
const MLC_VISTA_TITLE = 'MLC-VISTA';

const VERSION_PATTERN = /^(?:v|version\s*)?\d+\.\d+\.\d+$/i;
const PRODUCT_PATTERN =
  /^VISTA(?:\s*-\s*Visualised Intelligence & Situation Tracking Analysis)?$/i;

const STYLE = `
  :root {
    --mlc-swamp: #061819;
    --mlc-firefly: #0a2526;
    --mlc-tiber: #0d3133;
    --mlc-blue-dianne: #264648;
    --mlc-spectra: #3d5a5c;
    --mlc-identity-text: #e6e9e9;
    --mlc-identity-muted: #9ca9a9;
  }

  .mlc-vista-lockup {
    display: inline-grid !important;
    grid-template-columns: 28px minmax(0, 172px);
    align-items: center;
    column-gap: 8px;
    width: min(208px, 100%);
    min-width: 0;
    max-width: 208px;
    min-height: 30px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    vertical-align: middle;
    line-height: 1 !important;
  }

  .mlc-vista-mark {
    grid-column: 1;
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .mlc-vista-mark--light {
    display: none;
  }

  .mlc-vista-copy {
    grid-column: 2;
    display: grid;
    min-width: 0;
    align-content: center;
    row-gap: 2px;
  }

  .mlc-vista-product-row {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 6px;
  }

  .mlc-vista-product {
    color: var(--mlc-identity-text);
    font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0.14em;
    white-space: nowrap;
  }

  .mlc-vista-company {
    min-width: 0;
    overflow: hidden;
    color: var(--mlc-identity-muted);
    font: 600 6px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .mlc-vista-expansion {
    color: var(--mlc-identity-muted);
    font: 600 7px/1.15 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0.015em;
    white-space: normal;
  }

  .mlc-vista-expansion-line {
    display: block;
    white-space: nowrap;
  }

  :root[data-theme="light"] {
    --mlc-identity-text: var(--mlc-swamp);
    --mlc-identity-muted: var(--mlc-spectra);
  }

  :root[data-theme="light"] .mlc-vista-mark--dark {
    display: none;
  }

  :root[data-theme="light"] .mlc-vista-mark--light {
    display: block;
  }

  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --mlc-identity-text: var(--mlc-swamp);
      --mlc-identity-muted: var(--mlc-spectra);
    }

    :root:not([data-theme="dark"]) .mlc-vista-mark--dark {
      display: none;
    }

    :root:not([data-theme="dark"]) .mlc-vista-mark--light {
      display: block;
    }
  }

  @media (max-width: 980px) {
    .mlc-vista-lockup {
      grid-template-columns: 26px auto;
      width: auto;
      max-width: 88px;
      column-gap: 6px;
    }

    .mlc-vista-mark {
      width: 26px;
      height: 26px;
    }

    .mlc-vista-expansion {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .mlc-vista-company {
      display: none;
    }
  }
`;

function textNodesWithin(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function makeMark(className, source) {
  const mark = document.createElement('img');
  mark.className = `mlc-vista-mark ${className}`;
  mark.src = source;
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  return mark;
}

function buildLockup(brandNode, companyNode) {
  const host = brandNode.parentElement;
  if (!host || host.dataset.mlcVistaLockup === 'true') return false;

  host.dataset.mlcVistaLockup = 'true';
  host.classList.add('mlc-vista-lockup');
  host.setAttribute(
    'aria-label',
    `${MLC_VISTA_FULL_NAME}, by ${MLC_VISTA_COMPANY}`,
  );
  host.title =
    `${MLC_VISTA_FULL_NAME} | ${MLC_VISTA_COMPANY}`;

  const copy = document.createElement('span');
  copy.className = 'mlc-vista-copy';

  const productRow = document.createElement('span');
  productRow.className = 'mlc-vista-product-row';

  const product = document.createElement('span');
  product.className = 'mlc-vista-product';
  product.textContent = MLC_VISTA_PRODUCT;

  const company = document.createElement('span');
  company.className = 'mlc-vista-company';
  company.textContent = MLC_VISTA_COMPANY;

  const expansion = document.createElement('span');
  expansion.className = 'mlc-vista-expansion';

  const expansionLineOne = document.createElement('span');
  expansionLineOne.className = 'mlc-vista-expansion-line';
  expansionLineOne.textContent = 'Visualised Intelligence &';

  const expansionLineTwo = document.createElement('span');
  expansionLineTwo.className = 'mlc-vista-expansion-line';
  expansionLineTwo.textContent = 'Situation Tracking Analysis';

  expansion.append(expansionLineOne, expansionLineTwo);
  productRow.append(product, company);
  copy.append(productRow, expansion);

  if (companyNode) {
    companyNode.nodeValue = '';
  }

  host.replaceChildren(
    makeMark(
      'mlc-vista-mark--dark',
      '/branding/mercurylink/mark-inverted.svg',
    ),
    makeMark(
      'mlc-vista-mark--light',
      '/branding/mercurylink/mark-full-color.svg',
    ),
    copy,
  );
  return true;
}

function ensureTitle() {
  if (document.title !== MLC_VISTA_TITLE) {
    document.title = MLC_VISTA_TITLE;
  }
}

function applyMlcVistaIdentity() {
  ensureTitle();
  if (!document.body) return false;

  let applied = false;
  const nodes = textNodesWithin(document.body);

  for (const versionNode of nodes) {
    if (!VERSION_PATTERN.test(versionNode.nodeValue?.trim() || '')) continue;
    versionNode.nodeValue = MLC_VISTA_VERSION;

    let scope = versionNode.parentElement;
    for (
      let depth = 0;
      scope && depth < 6;
      depth += 1, scope = scope.parentElement
    ) {
      const brandNode = textNodesWithin(scope).find((node) =>
        PRODUCT_PATTERN.test(node.nodeValue?.trim() || ''),
      );
      if (!brandNode) continue;
      const companyNode = textNodesWithin(scope).find(
        (node) => node.nodeValue?.trim() === MLC_VISTA_COMPANY,
      );
      applied = buildLockup(brandNode, companyNode) || applied;
      break;
    }
  }

  if (applied) {
    document.documentElement.dataset.mlcVistaIdentity = 'applied';
  }
  return applied;
}

if (!document.getElementById('mlc-vista-identity-style')) {
  const style = document.createElement('style');
  style.id = 'mlc-vista-identity-style';
  style.textContent = STYLE;
  document.head.append(style);
}

applyMlcVistaIdentity();

const bodyObserver = new MutationObserver(() => {
  applyMlcVistaIdentity();
});
bodyObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

const titleElement = document.querySelector('title');
if (titleElement) {
  const titleObserver = new MutationObserver(ensureTitle);
  titleObserver.observe(titleElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

setTimeout(() => bodyObserver.disconnect(), 30000);
