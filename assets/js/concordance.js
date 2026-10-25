/*
 * Capital, Volume 1: edition concordance.
 *
 * Reads the JSON that _tabs/editions.md embeds from _data/capital/*.yml and
 * renders it into <div id="concordance">. Two views share one toolbar:
 *   Titles on  -> aligned table (cells span rows where another edition splits)
 *   Titles off -> structure map (block height = length of text)
 * No build step and no dependencies.
 */
(function () {
  'use strict';

  // ---- configuration -------------------------------------------------------

  var EDITIONS = [
    { key: 'r', file: 'reitter', name: 'Reitter', sub: 'Princeton 2024 · 2nd ed. text', de: false },
    { key: 'f', file: 'fowkes', name: 'Fowkes', sub: 'Penguin 1976 · 4th ed. text', de: false },
    { key: 'm', file: 'mew23', name: 'MEW 23', sub: 'Dietz · 4th ed. text', de: true, optional: true }
  ];

  var DEPTHS = [
    { id: 'parts', label: 'Parts', rank: 1 },
    { id: 'chapters', label: 'Chapters', rank: 2 },
    { id: 'sections', label: 'Sections', rank: 3 },
    { id: 'all', label: 'All headings', rank: 99 }
  ];

  // Map view: pixels per page of the measuring edition, per depth.
  var PX_PER_PAGE = { parts: 2, chapters: 2, sections: 3.5, all: 6 };
  // ...but no block is drawn shorter than this, so every block is visible and
  // has room for its label. The columns stay aligned because the minimum is
  // applied to stretches that all visible editions share (see mapLayout).
  var MIN_BLOCK_PX = 24;

  var STORE_KEY = 'capital-concordance-v1';
  var EN_NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  var DE_ORD = ['', 'Erster', 'Zweiter', 'Dritter', 'Vierter', 'Fünfter', 'Sechster', 'Siebenter', 'Achter'];

  // ---- helpers -------------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildTree(list) {
    var by = {};
    list.forEach(function (n) {
      var node = Object.assign({}, n);
      var p = n.parent ? by[n.parent] : null;
      node.parentNode = p;
      switch (n.kind) {
        case 'book': node.rank = 0; break;
        case 'part': node.rank = 1; break;
        case 'part-intro':
        case 'chapter': node.rank = 2; break;
        case 'section': node.rank = 3; break;
        case 'subsection': node.rank = p ? p.rank + 1 : 4; break;
        default: node.rank = -1; // front / back matter
      }
      if (n.kind === 'chapter') node.path = n.number;
      else if ((n.kind === 'section' || n.kind === 'subsection') && p) node.path = p.path + '.' + n.number;
      by[n.id] = node;
    });
    return by;
  }

  function project(tree, id, rank) {
    if (!id) return null;
    var n = tree[id];
    while (n && n.rank > rank && n.parentNode) n = n.parentNode;
    return n ? n.id : null;
  }

  // Headings above a node, top-down, without the book and without the node.
  function context(tree, id) {
    var out = [];
    var n = id ? tree[id] : null;
    n = n ? n.parentNode : null;
    while (n && n.kind !== 'book') { out.unshift(n.id); n = n.parentNode; }
    return out;
  }

  function ancestors(tree, id) {
    var out = [];
    var n = tree[id];
    while (n) { out.unshift(n.id); n = n.parentNode; }
    return out;
  }

  function lca(tree, ids) {
    var path = null;
    ids.forEach(function (id) {
      var a = ancestors(tree, id);
      if (!path) { path = a; return; }
      var i = 0;
      while (i < path.length && i < a.length && path[i] === a[i]) i++;
      path = path.slice(0, i);
    });
    return path && path.length ? path[path.length - 1] : null;
  }

  function pageLabel(ed, node) {
    return (ed.de ? 'S. ' : 'p. ') + node.page;
  }

  function longLabel(ed, node) {
    switch (node.kind) {
      case 'part':
        return ed.de ? (DE_ORD[+node.number] || node.number + '.') + ' Abschnitt'
                     : 'Part ' + (EN_NUM[+node.number] || node.number);
      case 'part-intro': return ed.de ? 'Einleitung' : 'Introduction';
      case 'chapter': return (ed.de ? 'Kapitel ' : 'Chapter ') + node.number;
      case 'section':
      case 'subsection': return '§ ' + node.path;
      default: return node.author || '';
    }
  }

  function shortLabel(ed, node) {
    switch (node.kind) {
      case 'part': return (ed.de ? 'Abschn. ' : 'Part ') + node.number;
      case 'part-intro': return ed.de ? 'Einl.' : 'Intro';
      case 'chapter': return (ed.de ? 'Kap ' : 'Ch ') + node.number;
      case 'section':
      case 'subsection': return '§' + node.path;
      default: return '';
    }
  }

  // Section numbers keep their printed case (Fowkes' "iii", Reitter's "a"),
  // so they are exempt from the small-caps label style.
  function numCls(node) {
    return node.kind === 'section' || node.kind === 'subsection' ? ' cc-num' : '';
  }

  function titleOf(node) {
    if (node.title) {
      if ((node.kind === 'front' || node.kind === 'back') && node.parentNode) {
        return node.parentNode.title + ' › ' + (node.number ? node.number + '. ' : '') + node.title;
      }
      return node.title;
    }
    if (node.parentNode && node.parentNode.title && (node.kind === 'front' || node.kind === 'back')) {
      return node.parentNode.title;
    }
    return null;
  }

  function loadState() {
    var s = null;
    try { s = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
    var wide = !window.matchMedia || window.matchMedia('(min-width: 768px)').matches;
    var d = { depth: 'chapters', mew: true, titles: wide };
    if (s && typeof s === 'object') {
      if (DEPTHS.some(function (x) { return x.id === s.depth; })) d.depth = s.depth;
      ['mew', 'titles'].forEach(function (k) { if (typeof s[k] === 'boolean') d[k] = s[k]; });
    }
    d.sel = null;
    return d;
  }

  function saveState(st) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        depth: st.depth, mew: st.mew, titles: st.titles
      }));
    } catch (e) { /* storage unavailable: settings just won't persist */ }
  }

  // Row positions in the measuring edition's pages. Rows that share the same
  // measuring id split its range evenly.
  function computeMeasure(body, trees, measure) {
    var key = (measure && measure.edition) || 'm';
    var tree = trees[key];
    var n = body.length;
    var start = new Array(n);
    var i = 0;
    while (i < n) {
      var j = i;
      while (j + 1 < n && body[j + 1][key] === body[i][key]) j++;
      var p = parseInt(tree[body[i][key]].page, 10);
      for (var k = i; k <= j; k++) start[k] = { group: i, count: j - i + 1, idx: k - i, page: p };
      i = j + 1;
    }
    var end = parseInt((measure && measure.end_page) || '0', 10);
    var y0 = new Array(n);
    var y1 = new Array(n);
    var base = start[0].page;
    for (var r = 0; r < n; r++) {
      var g = start[r];
      var nextGroupStart = g.group + g.count < n ? start[g.group + g.count].page : end;
      var len = (nextGroupStart - g.page) / g.count;
      y0[r] = g.page - base + g.idx * len;
      y1[r] = y0[r] + len;
    }
    return { y0: y0, y1: y1, total: y1[n - 1] };
  }

  // ---- the widget ----------------------------------------------------------

  function Concordance(root, data) {
    this.root = root;
    this.trees = {};
    var self = this;
    EDITIONS.forEach(function (ed) { self.trees[ed.key] = buildTree(data[ed.file]); });
    this.corr = data.correspondence;
    this.body = this.corr.body;
    this.measure = computeMeasure(this.body, this.trees, this.corr.measure);
    this.state = loadState();
    this.buildShell();
    this.render();
  }

  Concordance.prototype.cols = function () {
    var st = this.state;
    return EDITIONS.filter(function (ed) { return !ed.optional || st.mew; });
  };

  Concordance.prototype.rank = function () {
    var d = this.state.depth;
    return DEPTHS.filter(function (x) { return x.id === d; })[0].rank;
  };

  Concordance.prototype.buildShell = function () {
    var st = this.state;
    var depthButtons = DEPTHS.map(function (d) {
      return '<button type="button" class="cc-seg" data-depth="' + d.id + '">' + esc(d.label) + '</button>';
    }).join('');
    this.root.innerHTML =
      '<div class="cc-toolbar" role="toolbar" aria-label="Table options">' +
        '<div class="cc-group"><span class="cc-group-label" id="cc-depth-label">Depth</span>' +
          '<div class="cc-segs" role="group" aria-labelledby="cc-depth-label">' + depthButtons + '</div></div>' +
        '<div class="cc-group"><span class="cc-group-label">Show</span>' +
          '<label class="cc-check"><input type="checkbox" data-opt="mew"> MEW 23</label>' +
          '<label class="cc-check"><input type="checkbox" data-opt="titles"> Titles</label>' +
        '</div>' +
      '</div>' +
      '<details class="cc-apparatus"><summary>Prefaces, afterwords and editorial material</summary>' +
        '<div class="cc-apparatus-body"></div></details>' +
      '<div class="cc-view"></div>' +
      '<div class="cc-selbar" aria-live="polite" hidden></div>';

    var self = this;
    this.root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-depth],[data-block],[data-close]');
      if (!t || !self.root.contains(t)) return;
      if (t.hasAttribute('data-depth')) {
        self.state.depth = t.getAttribute('data-depth');
        if (self.state.sel) {
          var tree = self.trees[self.state.sel.col];
          self.state.sel.id = project(tree, self.state.sel.id, self.rank());
        }
      } else if (t.hasAttribute('data-block')) {
        var col = t.getAttribute('data-col');
        var id = t.getAttribute('data-block');
        var cur = self.state.sel;
        self.state.sel = cur && cur.col === col && cur.id === id ? null : { col: col, id: id };
      } else if (t.hasAttribute('data-close')) {
        self.state.sel = null;
      }
      saveState(self.state);
      self.render();
      if (t.hasAttribute('data-block') && self.state.sel) self.keepVisible(self.state.sel);
    });
    this.root.addEventListener('change', function (e) {
      var opt = e.target.getAttribute('data-opt');
      if (!opt) return;
      self.state[opt] = e.target.checked;
      if (opt === 'mew' && !e.target.checked && self.state.sel && self.state.sel.col === 'm') self.state.sel = null;
      saveState(self.state);
      self.render();
    });
  };

  Concordance.prototype.render = function () {
    var st = this.state;
    var root = this.root;
    root.querySelectorAll('[data-depth]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-depth') === st.depth));
    });
    root.querySelectorAll('[data-opt]').forEach(function (c) { c.checked = !!st[c.getAttribute('data-opt')]; });
    root.style.setProperty('--cc-cols', String(this.cols().length));
    root.querySelector('.cc-apparatus-body').innerHTML = this.renderApparatus();
    root.querySelector('.cc-view').innerHTML = st.titles ? this.renderTable() : this.renderMap();
    var bar = root.querySelector('.cc-selbar');
    if (!st.titles && st.sel) {
      bar.innerHTML = this.renderSelection();
      bar.hidden = false;
    } else {
      bar.hidden = true;
      bar.innerHTML = '';
    }
  };

  // After selecting, make sure the selected block is not hidden under the
  // sticky column heads or the selection bar.
  Concordance.prototype.keepVisible = function (sel) {
    var el = this.root.querySelector('[data-block="' + sel.id + '"][data-col="' + sel.col + '"]');
    var bar = this.root.querySelector('.cc-selbar');
    var head = this.root.querySelector('.cc-maphead');
    if (!el || !bar || bar.hidden) return;
    var r = el.getBoundingClientRect();
    var top = head ? head.getBoundingClientRect().bottom : 0;
    var bottom = bar.getBoundingClientRect().top;
    if (r.top >= top && r.bottom <= bottom) return;
    var target = (top + bottom) / 2;
    window.scrollBy({ top: r.top + Math.min(r.height, bottom - top) / 2 - target, behavior: 'smooth' });
  };

  Concordance.prototype.headRow = function (cls) {
    return this.cols().map(function (ed, k) {
      return '<div class="cc-head cc-ed-' + ed.key + ' ' + (cls || '') + '" style="grid-column:' + (k + 1) + '">' +
        '<span class="cc-head-name">' + esc(ed.name) + '</span>' +
        '<span class="cc-head-sub">' + esc(ed.sub) + '</span></div>';
    }).join('');
  };

  Concordance.prototype.cellHtml = function (ed, node, extraCls, gridRow, k) {
    var sr = '<span class="cc-sr">' + esc(ed.name) + ': </span>';
    if (!node) {
      return '<div class="cc-cell cc-empty ' + extraCls + '" style="grid-column:' + (k + 1) + ';grid-row:' + gridRow + '">' +
        sr + '<span class="cc-t">—</span></div>';
    }
    var title = titleOf(node);
    var lang = ed.de ? ' lang="de"' : '';
    return '<div class="cc-cell cc-ed-' + ed.key + ' ' + extraCls + '" style="grid-column:' + (k + 1) + ';grid-row:' + gridRow + '"' + lang + '>' +
      sr + '<span class="cc-n' + numCls(node) + '">' + esc(longLabel(ed, node)) + '</span>' +
      (title ? '<span class="cc-t">' + esc(title) + '</span>' : '<span class="cc-t cc-untitled">untitled</span>') +
      '<span class="cc-p">' + esc(pageLabel(ed, node)) + '</span></div>';
  };

  Concordance.prototype.renderApparatus = function () {
    var self = this;
    var cols = this.cols();
    var html = '<div class="cc-grid">' + this.headRow();
    var line = 1;
    this.corr.apparatus.forEach(function (row) {
      line++;
      cols.forEach(function (ed, k) {
        var id = row[ed.key];
        var node = id ? self.trees[ed.key][id] : null;
        var partial = node && row.partial && row.partial.indexOf(ed.key) >= 0;
        var h = self.cellHtml(ed, node, '', String(line), k);
        if (partial) h = h.replace('<span class="cc-p">', '<span class="cc-p">excerpt · ');
        html += h;
      });
    });
    return html + '</div>';
  };

  // Consecutive body rows that every visible edition projects to the same
  // headings at depth L. Shared by the table and the map.
  Concordance.prototype.units = function (L) {
    var self = this;
    var cols = this.cols();
    var units = [];
    this.body.forEach(function (row, i) {
      var ids = cols.map(function (ed) { return project(self.trees[ed.key], row[ed.key], L); });
      var last = units[units.length - 1];
      if (last && ids.every(function (id, k) { return id === last.ids[k]; })) last.end = i;
      else units.push({ ids: ids, start: i, end: i });
    });
    return units;
  };

  Concordance.prototype.renderTable = function () {
    var self = this;
    var cols = this.cols();
    var L = this.rank();
    var body = this.body;

    // 1. Collapse rows into units that are identical at this depth.
    var units = this.units(L);

    // 2. Lay out lines. Before a unit, each edition gets a heading line for
    // every enclosing heading it has not shown yet (Part, then Chapter, then
    // section...), so the context stays visible at every depth. Editions with
    // fewer new headings let their next cell absorb the spare lines (e.g.
    // Reitter ch. 24 beside Fowkes "Part Eight").
    var cells = cols.map(function () { return []; });
    var lastContent = cols.map(function () { return null; });
    var pending = cols.map(function () { return null; });
    var prevCtx = cols.map(function () { return []; });
    var line = 0;
    units.forEach(function (u) {
      var fresh = u.ids.map(function (id, k) {
        var ctx = context(self.trees[cols[k].key], id);
        var prev = prevCtx[k];
        var i = 0;
        while (i < ctx.length && i < prev.length && ctx[i] === prev[i]) i++;
        prevCtx[k] = ctx;
        return ctx.slice(i);
      });
      var n = Math.max.apply(null, fresh.map(function (f) { return f.length; }));
      for (var j = 0; j < n; j++) {
        line++;
        fresh.forEach(function (f, k) {
          if (f[j]) {
            cells[k].push({ type: 'heading', id: f[j], a: line, b: line });
            lastContent[k] = null;
          } else if (pending[k] === null) {
            pending[k] = line;
          }
        });
      }
      line++;
      u.ids.forEach(function (id, k) {
        var lc = lastContent[k];
        if (lc && lc.id === id) {
          lc.b = line;
          lc.spans++;
        } else {
          var c = { type: 'node', id: id, a: pending[k] !== null ? pending[k] : line, b: line, spans: 1 };
          if (pending[k] !== null) c.spans++;
          cells[k].push(c);
          lastContent[k] = c;
        }
        pending[k] = null;
      });
    });

    // 3. Emit a CSS grid; row 1 holds the column heads.
    var html = '<div class="cc-scroll"><div class="cc-grid cc-table">' + this.headRow();
    cells.forEach(function (list, k) {
      var ed = cols[k];
      var tree = self.trees[ed.key];
      list.forEach(function (c) {
        var gridRow = (c.a + 1) + ' / ' + (c.b + 2);
        var node = c.id ? tree[c.id] : null;
        if (c.type === 'heading') {
          html += '<div class="cc-part cc-ed-' + ed.key + (node.kind === 'part' ? '' : ' cc-subhead') + '" style="grid-column:' + (k + 1) + ';grid-row:' + gridRow + '"' +
            (ed.de ? ' lang="de"' : '') + '><span class="cc-sr">' + esc(ed.name) + ': </span>' +
            '<span class="cc-part-n' + numCls(node) + '">' + esc(longLabel(ed, node)) + '</span>' +
            '<span class="cc-part-t">' + esc(node.title || '') + '</span>' +
            '<span class="cc-p">' + esc(pageLabel(ed, node)) + '</span></div>';
        } else {
          html += self.cellHtml(ed, node, c.spans > 1 ? 'cc-span' : '', gridRow, k);
        }
      });
    });
    return html + '</div></div>';
  };

  Concordance.prototype.selectionRange = function () {
    var sel = this.state.sel;
    if (!sel) return null;
    var tree = this.trees[sel.col];
    if (!tree[sel.id]) return null;
    // The selection may be a Part or Chapter from the strips, i.e. coarser
    // than the current depth: match every row inside it.
    var r = tree[sel.id].rank;
    var a = -1, b = -1;
    this.body.forEach(function (row, i) {
      if (project(tree, row[sel.col], r) === sel.id) { if (a < 0) a = i; b = i; }
    });
    return a < 0 ? null : { a: a, b: b };
  };

  // Each unit gets a height proportional to its length, but at least
  // MIN_BLOCK_PX. Blocks are runs of units, so all columns share one grid.
  Concordance.prototype.mapLayout = function () {
    var px = PX_PER_PAGE[this.state.depth];
    var m = this.measure;
    var units = this.units(this.rank());
    var rowUnit = new Array(this.body.length);
    var y = 0;
    units.forEach(function (u, k) {
      u.top = y;
      u.h = Math.max((m.y1[u.end] - m.y0[u.start]) * px, MIN_BLOCK_PX);
      y += u.h;
      for (var i = u.start; i <= u.end; i++) rowUnit[i] = k;
    });
    return { units: units, rowUnit: rowUnit, height: Math.ceil(y) };
  };

  Concordance.prototype.renderMap = function () {
    var self = this;
    var st = this.state;
    var cols = this.cols();
    var L = this.rank();
    var lay = this.mapLayout();
    var units = lay.units;
    var range = this.selectionRange();
    if (st.sel && !range) st.sel = null;

    function runs(k, keyFn) {
      var out = [];
      units.forEach(function (u, i) {
        var id = keyFn(u.ids[k]);
        var last = out[out.length - 1];
        if (last && last.id === id) { last.ub = i; }
        else out.push({ id: id, ua: i, ub: i });
      });
      out.forEach(function (b) {
        b.top = units[b.ua].top;
        b.h = units[b.ub].top + units[b.ub].h - b.top;
        b.start = units[b.ua].start;
        b.end = units[b.ub].end;
      });
      return out;
    }

    var rules = {};
    var colsHtml = cols.map(function (ed, k) {
      var tree = self.trees[ed.key];
      function blockHtml(b, strip) {
        var node = b.id ? tree[b.id] : null;
        if (!node) return '';
        var h = b.h;
        var label = '';
        if (strip) label = h >= 18 ? (node.number || '') : '';
        else if (node.kind === 'part-intro') label = h >= 18 ? shortLabel(ed, node) : '';
        else if (h >= 18) label = shortLabel(ed, node) + ' · ' + pageLabel(ed, node);
        var cls = 'cc-block cc-ed-' + ed.key + (strip ? ' cc-strip-block' : '');
        if (range) {
          var hit = b.start <= range.b && b.end >= range.a;
          if (st.sel.col === ed.key && st.sel.id === b.id) cls += ' is-selected';
          else if (hit && !strip) cls += ' is-related';
        }
        var full = ed.name + ', ' + longLabel(ed, node) + (titleOf(node) ? ': ' + titleOf(node) : '') + ', ' + pageLabel(ed, node);
        return '<button type="button" data-block="' + esc(b.id) + '" data-col="' + ed.key + '"' +
          ' class="' + cls + '" style="top:' + b.top.toFixed(1) + 'px;height:' + Math.max(h - 2, 1).toFixed(1) + 'px"' +
          ' title="' + esc(full) + '" aria-label="' + esc(full) + '">' +
          '<span>' + esc(label) + '</span></button>';
      }
      // Narrow strips on the left show the enclosing Parts and, from Sections
      // depth down, the enclosing Chapters.
      var parts = runs(k, function (id) { return project(tree, id, 1); });
      parts.forEach(function (b, i) { if (i > 0) rules[b.top.toFixed(1)] = true; });
      var strips = [];
      if (L > 1) strips.push(parts);
      if (L > 2) strips.push(runs(k, function (id) { return project(tree, id, 2); }));
      var main = L === 1 ? parts : runs(k, function (id) { return id; });
      return '<div class="cc-mapcol">' +
        strips.map(function (stripRuns) {
          return '<div class="cc-strip">' + stripRuns.map(function (b) { return blockHtml(b, true); }).join('') + '</div>';
        }).join('') +
        '<div class="cc-lane">' + main.map(function (b) { return blockHtml(b, false); }).join('') + '</div></div>';
    }).join('');

    var rulesHtml = Object.keys(rules).map(function (y) {
      return '<div class="cc-rule" style="top:' + (parseFloat(y) - 1).toFixed(1) + 'px" aria-hidden="true"></div>';
    }).join('');
    if (range) {
      var ua = units[lay.rowUnit[range.a]];
      var ub = units[lay.rowUnit[range.b]];
      rulesHtml += '<div class="cc-selband" aria-hidden="true" style="top:' + (ua.top - 1).toFixed(1) +
        'px;height:' + (ub.top + ub.h - ua.top).toFixed(1) + 'px"></div>';
    }

    return '<div class="cc-grid cc-maphead">' + this.headRow() + '</div>' +
      '<div class="cc-map" style="height:' + lay.height + 'px">' + rulesHtml +
        '<div class="cc-mapcols">' + colsHtml + '</div></div>';
  };

  Concordance.prototype.renderSelection = function () {
    var self = this;
    var st = this.state;
    var range = this.selectionRange();
    if (!range) return '';
    var selRank = this.trees[st.sel.col][st.sel.id].rank;
    var L = this.rank();
    var body = this.body;

    // Rows covered by a node, per edition (cached per render).
    function spanOf(key, id) {
      var tree = self.trees[key];
      var r = tree[id].rank;
      var lo = -1, hi = -1;
      body.forEach(function (row, i) {
        if (row[key] && (row[key] === id || project(tree, row[key], r) === id)) { if (lo < 0) lo = i; hi = i; }
      });
      return lo + ':' + hi;
    }

    // What to show for another edition:
    // 1. its own heading covering exactly the same text, at or below the
    //    selection's level and as high up as that allows (MEW "Zweiter Abschnitt" -> Reitter "Part Two");
    // 2. otherwise its headings at the selection's level, or the first level
    //    below where it divides the text (Reitter Part Seven -> Fowkes
    //    Parts Seven-Eight; Reitter ch. 24 -> Fowkes chs. 26-32);
    // 3. otherwise the one heading that contains the text.
    var want = range.a + ':' + range.b;
    var cards = this.cols().map(function (ed, k) {
      var tree = self.trees[ed.key];
      var html;
      if (ed.key === st.sel.col) {
        html = self.cardHtml(ed, [tree[st.sel.id]], true);
      } else {
        var leaves = [];
        for (var i = range.a; i <= range.b; i++) if (body[i][ed.key]) leaves.push(body[i][ed.key]);
        if (!leaves.length) {
          html = self.cardHtml(ed, [], false);
        } else {
          var node = tree[lca(tree, leaves)];
          if (node && node.kind !== 'book' && node.rank >= selRank && spanOf(ed.key, node.id) === want) {
            while (node.parentNode && node.parentNode.kind !== 'book' && node.parentNode.rank >= selRank &&
                   spanOf(ed.key, node.parentNode.id) === want) node = node.parentNode;
            html = self.cardHtml(ed, [node], false);
          } else {
            var list = null;
            for (var r = Math.min(selRank, L); r <= Math.max(L, selRank) && !list; r++) {
              var projected = [];
              leaves.forEach(function (id) {
                var pid = project(tree, id, r);
                if (projected[projected.length - 1] !== pid) projected.push(pid);
              });
              if (projected.length > 1) list = projected;
              if (r >= L && !list) list = projected;
            }
            html = self.cardHtml(ed, list.map(function (pid) { return tree[pid]; }), false);
          }
        }
      }
      return '<div class="cc-card cc-ed-' + ed.key + (ed.key === st.sel.col ? ' is-selected' : '') + '" style="grid-column:' + (k + 1) + '"' + (ed.de ? ' lang="de"' : '') + '>' + html + '</div>';
    }).join('');
    return '<div class="cc-grid">' + cards + '</div>' +
      '<button type="button" class="cc-close" data-close aria-label="Clear selection">×</button>';
  };

  Concordance.prototype.cardHtml = function (ed, nodes, isSel) {
    var st = this.state;
    var name = '<span class="cc-sr">' + esc(ed.name) + ': </span>';
    if (!nodes.length) return name + '<span class="cc-card-h">—</span>';
    if (nodes.length === 1) {
      var n = nodes[0];
      return name + '<span class="cc-card-h">' + esc(longLabel(ed, n)) + ' · ' + esc(pageLabel(ed, n)) + '</span>' +
        '<span class="cc-card-t">' + esc(titleOf(n) || 'untitled') + '</span>';
    }
    var first = nodes[0], last = nodes[nodes.length - 1];
    var sameKind = nodes.every(function (n) { return n.kind === first.kind; });
    var span;
    if (sameKind && first.kind === 'part') {
      span = ed.de ? (DE_ORD[+first.number] || first.number) + '–' + (DE_ORD[+last.number] || last.number) + ' Abschnitt'
                   : 'Parts ' + (EN_NUM[+first.number] || first.number) + '–' + (EN_NUM[+last.number] || last.number);
    } else if (sameKind && first.kind === 'chapter') span = (ed.de ? 'Kapitel ' : 'Chapters ') + first.number + '–' + last.number;
    else if (sameKind && (first.kind === 'section' || first.kind === 'subsection')) span = '§ ' + first.path + '–' + last.path;
    else span = longLabel(ed, first) + ' – ' + longLabel(ed, last);
    var head = span + ' · ' + pageLabel(ed, first);
    return name + '<span class="cc-card-h">' + esc(head) + '</span><ul class="cc-card-list">' +
      nodes.map(function (n) {
        return '<li><span class="cc-card-n">' + esc(shortLabel(ed, n)) + '</span> ' + esc(titleOf(n) || 'untitled') + '</li>';
      }).join('') + '</ul>';
  };

  // ---- boot ----------------------------------------------------------------

  function boot() {
    var root = document.getElementById('concordance');
    if (!root) return;
    var src = document.getElementById(root.getAttribute('data-source') || 'concordance-data');
    try {
      new Concordance(root, JSON.parse(src.textContent));
    } catch (e) {
      root.textContent = 'The edition table could not be loaded.';
      if (window.console) console.error(e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
