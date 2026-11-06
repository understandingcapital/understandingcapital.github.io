---
layout: page
permalink: /editions/
icon: fas fa-book-open
order: 3
title: Editions
---

The Table of Content differs somewhat between the Fowkes and the Reitter translations, here's a correspondence table. Numbers in the podcast refer to the Reitter translation.
There's also a paragraph-matching tool for the Reitter, Fowkes, and (German) MEW 23 editions [available here](/passages/), which may be useful for reading groups that read different editions.

<link rel="stylesheet" href="{{ '/assets/css/concordance.css' | relative_url }}">

<div id="concordance" class="concordance" data-source="concordance-data">
  <noscript>This table needs JavaScript.</noscript>
</div>

<script type="application/json" id="concordance-data">{{ site.data.capital | jsonify }}</script>
<script src="{{ '/assets/js/concordance.js' | relative_url }}" defer></script>
