---
# Unlisted page: reachable at /editions/ but not shown in the sidebar.
# To make it a sidebar tab later, move this file into _tabs/, delete the
# `layout` and `permalink` lines, and add `
layout: page
permalink: /editions/
# icon: fas fa-book-open
# order: 5
title: Editions
---

<!-- Your intro text goes here, in Markdown, above the table. -->

<link rel="stylesheet" href="{{ '/assets/css/concordance.css' | relative_url }}">

<div id="concordance" class="concordance" data-source="concordance-data">
  <noscript>This table needs JavaScript.</noscript>
</div>

<script type="application/json" id="concordance-data">{{ site.data.capital | jsonify }}</script>
<script src="{{ '/assets/js/concordance.js' | relative_url }}" defer></script>
