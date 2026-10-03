const API_URL = 'https://ggsegverse.r-universe.dev/api/packages';
const SITE_URL = 'https://ggsegverse.github.io';
const CORE_PACKAGES = ['ggseg', 'ggseg3d', 'ggseg.formats', 'ggseg.extra'];

let cachedData = null;

export async function fetchPackages() {
  if (cachedData) return cachedData;

  const response = await fetch(API_URL);
  const data = await response.json();
  cachedData = data.filter(pkg => pkg.Title);
  return cachedData;
}

export async function getCorePackages() {
  const packages = await fetchPackages();
  return CORE_PACKAGES
    .map(name => packages.find(p => p.Package === name))
    .filter(Boolean)
    .map(transformPackage);
}

export async function getAtlasPackages() {
  const packages = await fetchPackages();
  return packages
    .filter(p => p.Package.startsWith('ggseg') && !CORE_PACKAGES.includes(p.Package))
    .sort((a, b) => a.Package.localeCompare(b.Package))
    .map(transformPackage);
}

// r-universe only knows what is in the tarball, and a pkgdown site publishes
// more than that: anything under vignettes/articles/ is Rbuildignored, so
// ggseg.extra's nine pre-knit tutorials never appear in the package metadata.
// Each package's pkgdown site is the authoritative list, read here from the
// articles.json that ggseg.extra's articles-index workflow commits.
async function fetchPkgdownIndex(pkg) {
  const response = await fetch(`${SITE_URL}/${pkg}/articles.json`);
  if (!response.ok) throw new Error(`no articles.json for ${pkg}`);
  const data = await response.json();

  return data.articles.map(a => ({
    package: pkg,
    title: a.title,
    section: a.section || null,
    url: `${SITE_URL}/${pkg}/${a.href}`
  }));
}

// Fallback for a package whose site predates the index: pkgdown's own
// articles listing carries the same titles and sections in its markup.
async function scrapePkgdownIndex(pkg) {
  const response = await fetch(`${SITE_URL}/${pkg}/articles/index.html`);
  if (!response.ok) throw new Error(`no articles index for ${pkg}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');

  const sections = doc.querySelectorAll('main .section');
  const scopes = sections.length ? sections : [doc.querySelector('main')].filter(Boolean);

  const articles = [];
  for (const scope of scopes) {
    const heading = scope.querySelector('h2, h3');
    for (const link of scope.querySelectorAll('dl dt a[href]')) {
      const href = link.getAttribute('href');
      if (!href.endsWith('.html')) continue;
      articles.push({
        package: pkg,
        title: link.textContent.trim(),
        section: sections.length && heading ? heading.textContent.trim() : null,
        url: `${SITE_URL}/${pkg}/articles/${href}`
      });
    }
  }
  return articles;
}

// Only the last step here loses anything: both pkgdown sources list the same
// articles, but r-universe cannot see the ones outside the tarball. Reaching
// it costs ggseg.extra its ten website-only tutorials, so say so rather than
// degrading silently to a page that is merely missing things.
async function getPkgdownArticles(pkg) {
  try {
    return await fetchPkgdownIndex(pkg);
  } catch {
    try {
      return await scrapePkgdownIndex(pkg);
    } catch (error) {
      console.warn(`${pkg}: no pkgdown article index, using r-universe`, error);
      return [];
    }
  }
}

export async function getVignettes() {
  const packages = await fetchPackages();
  const byPackage = new Map();

  for (const pkg of packages) {
    if (!pkg.Package.startsWith('ggseg')) continue;
    const vigs = (pkg._vignettes || []).map(vig => ({
      package: pkg.Package,
      title: vig.title,
      section: null,
      url: `${SITE_URL}/${pkg.Package}/articles/${vig.source.replace(/\.(Rmd|rmd|qmd)$/, '.html')}`
    }));
    if (vigs.length) {
      byPackage.set(pkg.Package, vigs.sort((a, b) => a.title.localeCompare(b.title)));
    }
  }

  // Only the core packages are worth an extra request each: the atlas
  // packages ship no website-only articles and there are around thirty of
  // them. A package's pkgdown index replaces its r-universe entries rather
  // than adding to them -- it is a superset, it carries the section each
  // article belongs to, and its declared order is the one the site uses.
  const indexed = await Promise.all(CORE_PACKAGES.map(getPkgdownArticles));
  CORE_PACKAGES.forEach((pkg, i) => {
    if (indexed[i].length) byPackage.set(pkg, indexed[i]);
  });

  return Array.from(byPackage.keys())
    .sort((a, b) => a.localeCompare(b))
    .flatMap(pkg => byPackage.get(pkg));
}

export async function getContributors() {
  const packages = await fetchPackages();
  const contributorMap = new Map();

  for (const pkg of packages) {
    const contributors = pkg._contributors || [];
    for (const c of contributors) {
      const existing = contributorMap.get(c.user) || { user: c.user, contributions: 0 };
      existing.contributions += c.count || 0;
      contributorMap.set(c.user, existing);
    }
  }

  return Array.from(contributorMap.values())
    .sort((a, b) => b.contributions - a.contributions)
    .map(c => ({
      ...c,
      avatar_url: `https://github.com/${c.user}.png?size=160`
    }));
}

const TYPE_CONCEPTS = {
  cortical_atlases: 'cortical',
  subcortical_atlases: 'subcortical',
  cerebellar_atlases: 'cerebellar',
  tract_atlases: 'tract'
};

export async function getAtlases() {
  const packages = await fetchPackages();
  const atlases = [];

  for (const pkg of packages) {
    if (!pkg.Package.startsWith('ggseg')) continue;
    const helpPages = pkg._help || [];

    for (const h of helpPages) {
      const concepts = Array.isArray(h.concept) ? h.concept : (h.concept ? [h.concept] : []);
      if (!concepts.includes('ggseg_atlases')) continue;

      const type = concepts.map(c => TYPE_CONCEPTS[c]).find(Boolean) || null;

      atlases.push({
        name: h.page,
        title: h.title,
        package: pkg.Package,
        type,
        docsUrl: `https://ggsegverse.github.io/${pkg.Package}/reference/${h.page}.html`
      });
    }
  }

  return atlases.sort((a, b) => a.name.localeCompare(b.name));
}

function transformPackage(pkg) {
  const url = pkg.URL || '';
  const githubUrl = url.includes('github.com')
    ? url.split(',')[0]
    : `https://github.com/ggsegverse/${pkg.Package}`;

  return {
    package: pkg.Package,
    title: pkg.Title,
    version: pkg.Version,
    description: pkg.Description,
    maintainer: pkg._maintainer?.name,
    maintainer_login: pkg._maintainer?.login,
    status: pkg._status,
    stars: pkg._stars,
    logo: pkg._pkglogo,
    github_url: githubUrl,
    pkgdown_url: `https://ggsegverse.github.io/${pkg.Package}/`,
    on_cran: pkg._cranurl === true
  };
}
