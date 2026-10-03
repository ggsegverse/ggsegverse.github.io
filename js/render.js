export function renderCorePackages(packages, container) {
  container.innerHTML = packages.map((pkg, i) => `
    <div class="package-card" style="animation-delay: ${i * 0.08}s">
      ${pkg.logo ? `<img src="${pkg.logo}" class="pkg-logo" alt="${pkg.package} logo">` : ''}
      <h3>${pkg.package}</h3>
      <div class="package-meta">
        <span class="lang-badge lang-badge-r">R</span>
        <a href="https://ggsegverse.r-universe.dev/${pkg.package}" target="_blank">
          <span class="version">${pkg.version}</span>
        </a>
        ${pkg.on_cran ? `
          <a href="https://cran.r-project.org/package=${pkg.package}" target="_blank">
            <span class="cran-badge">CRAN</span>
          </a>
        ` : ''}
        ${pkg.stars ? `
          <a href="${pkg.github_url}/stargazers" target="_blank">
            <span class="stars-badge">&#9733; ${pkg.stars}</span>
          </a>
        ` : ''}
        <span class="status-badge status-${pkg.status === 'success' ? 'passing' : 'failing'}">
          ${pkg.status === 'success' ? 'passing' : 'failing'}
        </span>
      </div>
      <p class="description">${pkg.description || pkg.title}</p>
      <div class="links">
        <a href="${pkg.pkgdown_url}" target="_blank">Docs</a>
        <a href="${pkg.github_url}" target="_blank">GitHub</a>
      </div>
    </div>
  `).join('');
}

export function renderAtlasPackages(packages, container) {
  container.innerHTML = packages.map((pkg, i) => `
    <div class="atlas-card" style="animation-delay: ${i * 0.05}s">
      ${pkg.logo ? `<img src="${pkg.logo}" class="pkg-logo" alt="${pkg.package} logo">` : ''}
      <h4>${pkg.package}</h4>
      <div class="package-meta">
        <a href="https://ggsegverse.r-universe.dev/${pkg.package}" target="_blank">
          <span class="version">${pkg.version}</span>
        </a>
        ${pkg.on_cran ? `
          <a href="https://cran.r-project.org/package=${pkg.package}" target="_blank">
            <span class="cran-badge">CRAN</span>
          </a>
        ` : ''}
        <span class="status-badge status-${pkg.status === 'success' ? 'passing' : 'failing'}">
          ${pkg.status === 'success' ? 'passing' : 'failing'}
        </span>
      </div>
      <div class="links">
        <a href="${pkg.pkgdown_url}" target="_blank">Docs</a>
        <a href="${pkg.github_url}" target="_blank">GitHub</a>
      </div>
    </div>
  `).join('');
}

// Article titles and sections now come partly from markup scraped off the
// pkgdown sites, so they reach innerHTML as untrusted text rather than as
// values this repo controls.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

export function renderVignettes(vignettes, container) {
  const grouped = {};
  for (const v of vignettes) {
    if (!grouped[v.package]) grouped[v.package] = [];
    grouped[v.package].push(v);
  }

  const items = vigs => vigs.map(v => `
    <a href="${escapeHtml(v.url)}" target="_blank" class="vignette-item">
      <span class="vignette-icon">📄</span>
      <span class="vignette-title">${escapeHtml(v.title)}</span>
    </a>
  `).join('');

  // A package whose articles declare sections gets them as subheadings; with
  // sixteen of them in one card, ggseg.extra is unreadable as a flat list.
  const body = vigs => {
    const sections = [];
    for (const v of vigs) {
      const title = v.section;
      const last = sections[sections.length - 1];
      if (last && last.title === title) last.vigs.push(v);
      else sections.push({ title, vigs: [v] });
    }

    // One section is no sections: pkgdown names the single catch-all group
    // "All vignettes", which says nothing the card's own heading does not.
    if (sections.length < 2 || !sections.every(s => s.title)) {
      return `<div class="vignette-list">${items(vigs)}</div>`;
    }

    return sections.map(s => `
      <div class="vignette-section">
        <h4 class="vignette-section-title">${escapeHtml(s.title)}</h4>
        <div class="vignette-list">${items(s.vigs)}</div>
      </div>
    `).join('');
  };

  container.innerHTML = Object.entries(grouped).map(([pkg, vigs]) => `
    <div class="docs-package-card">
      <div class="docs-package-header">
        <h3>${escapeHtml(pkg)}</h3>
        <a href="https://ggsegverse.github.io/${encodeURIComponent(pkg)}/" target="_blank" class="docs-site-link">
          Full docs &rarr;
        </a>
      </div>
      ${body(vigs)}
    </div>
  `).join('');
}

export function renderContributors(contributors, container) {
  container.innerHTML = contributors.map(c => `
    <div class="contributor-card">
      <a href="https://github.com/${c.user}" target="_blank">
        <img src="${c.avatar_url}" alt="${c.user}" loading="lazy">
      </a>
      <div class="name">${c.user}</div>
      <div class="contributions">${c.contributions} contributions</div>
    </div>
  `).join('');
}

export function renderAtlases(atlases, container) {
  container.innerHTML = atlases.map((atlas, i) => `
    <div class="atlas-dataset-card atlas-type-${atlas.type || 'unknown'} fade-in-up" style="animation-delay: ${Math.min(i * 0.03, 0.5)}s">
      <div class="atlas-header">
        ${atlas.docsUrl
          ? `<a href="${atlas.docsUrl}" target="_blank" class="atlas-title-link">${atlas.title}</a>`
          : `<span class="atlas-title">${atlas.title}</span>`
        }
        <code class="atlas-code">${atlas.name}</code>
      </div>
      <div class="atlas-footer">
        <span class="atlas-package-label">${atlas.package}</span>
        ${atlas.type ? `<span class="atlas-type-badge atlas-type-badge-${atlas.type}">${atlas.type}</span>` : ''}
      </div>
    </div>
  `).join('');
}

export function renderFunders(data, container) {
  container.innerHTML = data.categories.map(cat => `
    <div class="funding-category">
      <h3 class="funding-category-title">
        <span class="funding-icon">${cat.icon}</span>
        ${cat.name}
      </h3>
      <div class="funder-grid">
        ${cat.funders.map(f => `
          <a href="${f.url}" target="_blank" class="funder-card">
            ${f.grant ? `<span class="grant-badge">Grant ${f.grant}</span>` : ''}
            <h4>${f.name}</h4>
            <p class="funder-description">${f.description}</p>
            ${f.pi ? `<span class="funder-pi">PI: ${f.pi}</span>` : ''}
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');
}
