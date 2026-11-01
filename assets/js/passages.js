/* Capital, Volume 1: passage finder.
 *
 * Given a page (and optionally a paragraph) in one edition, shows where the
 * same passage is in the other two. The data (assets/data/capital-passages.json)
 * holds coordinates only: it is written by paratools/build_public.py from the
 * local reader's data, so corrections made there carry over.
 *
 * Paragraphs are counted per page; a paragraph carried over from the previous
 * page is ¶1. Links use the same form as the local reader: #fowkes/235/3.
 */
(function () {
  'use strict';

  var EDS = [
    { key: 'r', slug: 'reitter', name: 'Reitter', sub: 'Princeton 2024', p: 'p.' },
    { key: 'f', slug: 'fowkes', name: 'Fowkes', sub: 'Penguin 1976', p: 'p.' },
    { key: 'm', slug: 'mew23', name: 'MEW 23', sub: 'Dietz', p: 'S.' }
  ];
  var BY_KEY = {}, BY_SLUG = {};
  EDS.forEach(function (e) { BY_KEY[e.key] = e; BY_SLUG[e.slug] = e; });
  var KIND = { q: 'quotation', x: 'table' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function Finder(root, D) {
    this.root = root;
    this.D = D;
    var self = this;
    // row of each paragraph, and each page's paragraphs in order
    this.rowOf = {}; this.onPage = {}; this.range = {};
    EDS.forEach(function (e) {
      var k = e.key, rowOf = self.rowOf[k] = [], on = self.onPage[k] = {};
      D.rows.forEach(function (r, ri) { r[k].forEach(function (i) { rowOf[i] = ri; }); });
      D.paras[k].forEach(function (p, i) {
        p[0].forEach(function (pg) { (on[pg] = on[pg] || []).push(i); });
      });
      var pages = Object.keys(on).map(Number);
      self.range[k] = [Math.min.apply(null, pages), Math.max.apply(null, pages)];
    });
    this.state = { ed: 'f', page: null, para: null };
    this.build();
    window.addEventListener('hashchange', function () { self.fromHash(); });
    this.fromHash();
  }

  // where a paragraph is, as the reader counts it
  Finder.prototype.coord = function (k, i) {
    var p = this.D.paras[k][i];
    return { page: p[0][0], para: p[1], last: p[0][p[0].length - 1] };
  };

  Finder.prototype.build = function () {
    var segs = EDS.map(function (e) {
      return '<button type="button" class="pf-seg" data-ed="' + e.key + '">' + esc(e.name) + '</button>';
    }).join('');
    this.root.innerHTML =
      '<form class="pf-form" novalidate>' +
        '<div class="pf-segs" role="group" aria-label="Edition">' + segs + '</div>' +
        '<label class="pf-field"><span class="pf-lab">Page</span>' +
          '<input type="number" inputmode="numeric" min="1" name="page" required></label>' +
        '<label class="pf-field"><span class="pf-lab">¶ <span class="pf-opt">(optional)</span></span>' +
          '<input type="number" inputmode="numeric" min="1" name="para"></label>' +
        '<button type="submit" class="pf-go">Find</button>' +
      '</form>' +
      '<div class="pf-status" aria-live="polite"></div>' +
      '<div class="pf-out"></div>';
    var self = this, form = this.root.querySelector('form');
    form.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ed]');
      if (!b) return;
      self.state.ed = b.getAttribute('data-ed');
      self.paintForm();
      form.page.focus();
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var pg = parseInt(form.page.value, 10), pa = parseInt(form.para.value, 10);
      if (!pg) { form.page.focus(); return; }
      self.go(self.state.ed, pg, pa || null);
    });
    this.root.addEventListener('click', function (ev) {
      var a = ev.target.closest('a[data-go]');
      if (!a) return;
      ev.preventDefault();
      var g = a.getAttribute('data-go').split('/');
      self.go(g[0], +g[1], g[2] ? +g[2] : null);
    });
    this.paintForm();
  };

  Finder.prototype.paintForm = function () {
    var st = this.state, form = this.root.querySelector('form');
    form.querySelectorAll('[data-ed]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-ed') === st.ed));
    });
    var r = this.range[st.ed];
    form.page.placeholder = r[0] + '–' + r[1];
    if (st.page) form.page.value = st.page;
    form.para.value = st.para || '';
  };

  Finder.prototype.go = function (k, page, para) {
    var h = '#' + BY_KEY[k].slug + '/' + page + (para ? '/' + para : '');
    if (location.hash === h) this.fromHash();
    else location.hash = h;
  };

  Finder.prototype.fromHash = function () {
    var m = /^#([a-z0-9]+)\/(\d+)(?:\/(\d+))?$/.exec(location.hash);
    if (!m || !BY_SLUG[m[1]]) { this.paintForm(); return; }
    this.state = { ed: BY_SLUG[m[1]].key, page: +m[2], para: m[3] ? +m[3] : null };
    this.paintForm();
    this.render();
  };

  Finder.prototype.link = function (k, i, cls) {
    var c = this.coord(k, i), e = BY_KEY[k];
    var txt = e.p + ' ' + c.page + ' ¶' + c.para + (c.last !== c.page ? ' – ' + c.last : '');
    return '<a href="#' + e.slug + '/' + c.page + '/' + c.para + '" data-go="' + k + '/' + c.page + '/' + c.para + '"' +
      (cls ? ' class="' + cls + '"' : '') + '>' + txt + '</a>';
  };

  Finder.prototype.render = function () {
    var st = this.state, D = this.D, k = st.ed, e = BY_KEY[k], self = this;
    var status = this.root.querySelector('.pf-status'), out = this.root.querySelector('.pf-out');
    var on = this.onPage[k][st.page];
    if (!on) {
      var r = this.range[k];
      status.textContent = e.name + ' ' + e.p + ' ' + st.page + ' has no main text (the body runs from ' + e.p + ' ' + r[0] + ' to ' + r[1] + ').';
      out.innerHTML = '';
      return;
    }
    var target = null;
    if (st.para) {
      target = on[st.para - 1];
      if (target === undefined) {
        status.textContent = e.name + ' ' + e.p + ' ' + st.page + ' has ' + on.length + ' paragraph' + (on.length > 1 ? 's' : '') + '; showing them all.';
        target = null;
      }
    }
    if (target !== null || !st.para) {
      status.textContent = target !== null
        ? e.name + ' ' + e.p + ' ' + st.page + ' ¶' + st.para + ' (of ' + on.length + ' on the page)'
        : e.name + ' ' + e.p + ' ' + st.page + ': ' + on.length + ' paragraph' + (on.length > 1 ? 's' : '');
    }
    // rows touching the page, in order
    var rows = [];
    on.forEach(function (i) { var ri = self.rowOf[k][i]; if (rows.indexOf(ri) < 0) rows.push(ri); });
    rows.sort(function (a, b) { return a - b; });
    var onSet = {}; on.forEach(function (i) { onSet[i] = true; });

    var html = '<div class="pf-grid">';
    EDS.forEach(function (x) {
      html += '<div class="pf-head pf-ed-' + x.key + '"><span class="pf-name">' + esc(x.name) + '</span>' +
        '<span class="pf-sub">' + esc(x.sub) + '</span></div>';
    });
    var lastHead = null;
    rows.forEach(function (ri) {
      var row = D.rows[ri];
      // a heading line when the section changes
      var heads = EDS.map(function (x) {
        var i = row[x.key][0];
        return i === undefined ? '' : D.heads[x.key][D.paras[x.key][i][2]];
      });
      var hk = heads.join('|');
      if (hk !== lastHead) {
        lastHead = hk;
        EDS.forEach(function (x, n) {
          html += '<div class="pf-sec pf-ed-' + x.key + '">' + (heads[n] ? esc(heads[n]) : '') + '</div>';
        });
      }
      var hit = target !== null ? row[k].indexOf(target) >= 0 : false;
      EDS.forEach(function (x) {
        var ps = row[x.key];
        html += '<div class="pf-cell pf-ed-' + x.key + (x.key === 'r' ? ' pf-first' : '') + (hit ? ' pf-hit' : '') + '">' +
          '<span class="pf-edlab">' + esc(x.name) + '</span>';
        if (!ps.length) html += '<span class="pf-none">no counterpart</span>';
        ps.forEach(function (i) {
          var p = D.paras[x.key][i];
          var mine = x.key === k && onSet[i];
          var cls = mine ? (i === target ? 'pf-me pf-target' : 'pf-me') : '';
          html += '<span class="pf-par">' + self.link(x.key, i, cls) +
            (KIND[p[3]] ? ' <span class="pf-kind">' + KIND[p[3]] + '</span>' : '') +
            (p[4].length ? ' <span class="pf-notes">n. ' + p[4].map(esc).join(', ') + '</span>' : '') +
            '</span>';
        });
        html += '</div>';
      });
      var extra = [];
      if (row.ed) extra.push('<span class="pf-tag">Later edition</span> ' + esc(row.ed));
      if (row.note) extra.push('<span class="pf-tag">Note</span> ' + esc(row.note));
      if (extra.length) html += '<div class="pf-rownote' + (hit ? ' pf-hit' : '') + '">' + extra.join('<br>') + '</div>';
    });
    html += '</div>';
    var r = this.range[k], prev = st.page > r[0] ? st.page - 1 : null, next = st.page < r[1] ? st.page + 1 : null;
    html += '<nav class="pf-pager" aria-label="Pages">' +
      (prev ? '<a href="#' + e.slug + '/' + prev + '" data-go="' + k + '/' + prev + '">← ' + e.p + ' ' + prev + '</a>' : '<span></span>') +
      (next ? '<a href="#' + e.slug + '/' + next + '" data-go="' + k + '/' + next + '">' + e.p + ' ' + next + ' →</a>' : '<span></span>') +
      '</nav>';
    out.innerHTML = html;
    var t = out.querySelector('.pf-target');
    if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest' });
  };

  function init() {
    var root = document.getElementById('passage-finder');
    if (!root) return;
    fetch(root.getAttribute('data-src'))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (D) { new Finder(root, D); })
      .catch(function () { root.textContent = 'The passage data could not be loaded.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
