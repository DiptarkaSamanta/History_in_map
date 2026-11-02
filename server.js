const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const PORT = process.env.PORT || 8081;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Load datasets into memory
function loadJSON(filename) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err.message);
    return null;
  }
}

const datasets = {
  kingdoms: loadJSON('kingdoms.json') || [],
  rulers: loadJSON('rulers.json') || [],
  wars: loadJSON('wars.json') || [],
  boundaries: loadJSON('boundaries.geojson') || { type: 'FeatureCollection', features: [] }
};

// Helper: check if year falls within start and end
function isYearActive(item, targetYear) {
  if (typeof item.start !== 'number' || typeof item.end !== 'number') return false;
  const min = Math.min(item.start, item.end);
  const max = Math.max(item.start, item.end);
  return targetYear >= min && targetYear <= max;
}

// MIME types dictionary for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// JSON response helper
function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload, null, 2));
}

// Router for REST API
function handleAPI(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method !== 'GET') {
    return sendJSON(res, 405, { error: 'Method Not Allowed' });
  }

  // GET /api or /api/docs
  if (pathname === '/api' || pathname === '/api/docs') {
    return sendJSON(res, 200, {
      name: 'India Through Time — Historical Atlas REST API',
      version: '1.0.0',
      description: 'REST API for querying historical kingdoms, rulers, wars, and GeoJSON boundary polygons.',
      endpoints: {
        'GET /api/kingdoms': {
          description: 'List all kingdoms or filter by year, query, era, or region',
          params: {
            year: 'Integer (e.g. 1600 or -300 for BCE)',
            q: 'Search string matching name, region, rulers, or summary',
            era: 'Era filter (Ancient, Medieval, Early Modern, Modern)',
            region: 'Region substring (e.g. "North", "South")'
          },
          examples: [
            '/api/kingdoms?year=1600',
            '/api/kingdoms?q=mughal',
            '/api/kingdoms?era=Ancient'
          ]
        },
        'GET /api/kingdoms/:id': {
          description: 'Get details for a single kingdom, including linked wars and known rulers',
          examples: ['/api/kingdoms/mughal', '/api/kingdoms/maurya']
        },
        'GET /api/wars': {
          description: 'List wars or filter by year, participant kingdom, or search query',
          params: {
            year: 'Integer year (e.g. 1526)',
            q: 'Search term',
            kingdom: 'Participant kingdom name or ID'
          },
          examples: ['/api/wars?year=1526', '/api/wars?q=panipat']
        },
        'GET /api/wars/:id': {
          description: 'Get details for a specific battle / war record',
          examples: ['/api/wars/w4']
        },
        'GET /api/rulers': {
          description: 'List historical rulers or search by name / kingdom',
          params: {
            q: 'Ruler name search',
            kingdom: 'Filter by kingdom name'
          },
          examples: ['/api/rulers?q=ashoka', '/api/rulers?kingdom=chola']
        },
        'GET /api/boundaries': {
          description: 'Get GeoJSON boundary extents. Filter by year to get only active kingdoms.',
          params: {
            year: 'Filter GeoJSON features by active kingdom year',
            id: 'Get GeoJSON feature for a single kingdom'
          },
          examples: ['/api/boundaries?year=1600', '/api/boundaries?id=maurya']
        },
        'GET /api/stats': {
          description: 'Get dataset overview statistics and era breakdowns'
        },
        'GET /api/health': {
          description: 'Healthcheck status and server uptime'
        }
      }
    });
  }

  // GET /api/health
  if (pathname === '/api/health') {
    return sendJSON(res, 200, {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  // GET /api/stats
  if (pathname === '/api/stats') {
    const eraCounts = {};
    for (const k of datasets.kingdoms) {
      eraCounts[k.era] = (eraCounts[k.era] || 0) + 1;
    }
    return sendJSON(res, 200, {
      totalKingdoms: datasets.kingdoms.length,
      totalWars: datasets.wars.length,
      totalRulers: datasets.rulers.length,
      eras: eraCounts
    });
  }

  // GET /api/kingdoms/:id
  const kingdomMatch = pathname.match(/^\/api\/kingdoms\/([a-zA-Z0-9_-]+)$/);
  if (kingdomMatch) {
    const id = kingdomMatch[1].toLowerCase();
    const kingdom = datasets.kingdoms.find(k => k.id.toLowerCase() === id);
    if (!kingdom) {
      return sendJSON(res, 404, { error: `Kingdom '${id}' not found` });
    }
    const relatedWars = datasets.wars.filter(w =>
      w.participants.some(p => p.toLowerCase().includes(kingdom.name.toLowerCase().split(' ')[0]))
    );
    const boundary = datasets.boundaries.features.find(f => f.properties.id === kingdom.id);
    return sendJSON(res, 200, {
      ...kingdom,
      relatedWars,
      boundary: boundary || null
    });
  }

  // GET /api/kingdoms
  if (pathname === '/api/kingdoms') {
    let result = [...datasets.kingdoms];

    if (query.year !== undefined) {
      const year = parseInt(query.year, 10);
      if (!isNaN(year)) {
        result = result.filter(k => isYearActive(k, year));
      }
    }

    if (query.era) {
      const era = query.era.toLowerCase();
      result = result.filter(k => k.era && k.era.toLowerCase().includes(era));
    }

    if (query.region) {
      const region = query.region.toLowerCase();
      result = result.filter(k => k.region && k.region.toLowerCase().includes(region));
    }

    if (query.q || query.search) {
      const q = (query.q || query.search).toLowerCase();
      result = result.filter(k =>
        [k.name, k.region, k.capital, k.summary, ...(k.rulers || [])]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    return sendJSON(res, 200, {
      count: result.length,
      total: datasets.kingdoms.length,
      data: result
    });
  }

  // GET /api/wars/:id
  const warMatch = pathname.match(/^\/api\/wars\/([a-zA-Z0-9_-]+)$/);
  if (warMatch) {
    const id = warMatch[1].toLowerCase();
    const war = datasets.wars.find(w => w.id.toLowerCase() === id);
    if (!war) {
      return sendJSON(res, 404, { error: `War record '${id}' not found` });
    }
    return sendJSON(res, 200, war);
  }

  // GET /api/wars
  if (pathname === '/api/wars') {
    let result = [...datasets.wars];

    if (query.year !== undefined) {
      const year = parseInt(query.year, 10);
      if (!isNaN(year)) {
        result = result.filter(w => isYearActive(w, year));
      }
    }

    if (query.kingdom) {
      const k = query.kingdom.toLowerCase();
      result = result.filter(w =>
        w.participants.some(p => p.toLowerCase().includes(k))
      );
    }

    if (query.q || query.search) {
      const q = (query.q || query.search).toLowerCase();
      result = result.filter(w =>
        [w.name, w.location, w.description, ...(w.participants || [])]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    return sendJSON(res, 200, {
      count: result.length,
      total: datasets.wars.length,
      data: result
    });
  }

  // GET /api/rulers
  if (pathname === '/api/rulers') {
    let result = [...datasets.rulers];

    if (query.kingdom) {
      const kingdomFilter = query.kingdom.toLowerCase();
      result = result.filter(r => (r.polity || r.kingdom || '').toLowerCase().includes(kingdomFilter));
    }

    if (query.q || query.search) {
      const q = (query.q || query.search).toLowerCase();
      result = result.filter(r =>
        [(r.name || ''), (r.polity || ''), (r.notes || '')]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    return sendJSON(res, 200, {
      count: result.length,
      total: datasets.rulers.length,
      data: result
    });
  }

  // GET /api/boundaries
  if (pathname === '/api/boundaries') {
    let features = datasets.boundaries.features || [];

    if (query.id || query.kingdom) {
      const targetId = (query.id || query.kingdom).toLowerCase();
      const feature = features.find(f => f.properties && f.properties.id.toLowerCase() === targetId);
      if (!feature) {
        return sendJSON(res, 404, { error: `Boundary for '${targetId}' not found` });
      }
      return sendJSON(res, 200, feature);
    }

    if (query.year !== undefined) {
      const year = parseInt(query.year, 10);
      if (!isNaN(year)) {
        const activeKingdomIds = new Set(
          datasets.kingdoms.filter(k => isYearActive(k, year)).map(k => k.id)
        );
        features = features.filter(f => activeKingdomIds.has(f.properties && f.properties.id));
      }
    }

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      name: 'historical_extents',
      count: features.length,
      features
    });
  }

  // Unknown API endpoint
  return sendJSON(res, 404, {
    error: 'API endpoint not found',
    documentation: '/api'
  });
}

// Static file handler
function handleStatic(req, res, parsedUrl) {
  let relativePath = parsedUrl.pathname;
  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, relativePath));

  // Security: prevent directory traversal outside ROOT_DIR
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

// Main HTTP request handler
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname.startsWith('/api')) {
    handleAPI(req, res, parsedUrl);
  } else {
    handleStatic(req, res, parsedUrl);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Indian Historical Atlas & REST API Server`);
  console.log(` Web App:  http://localhost:${PORT}`);
  console.log(` REST API: http://localhost:${PORT}/api`);
  console.log(`====================================================`);
});

