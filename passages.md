---
# Unlisted page: reachable at /passages/ but not shown in the sidebar.
# To make it a sidebar tab later, move this file into _tabs/, delete the
# `layout` and `permalink` lines, and add an `icon` and `order`.
#
# The data file assets/data/capital-passages.json is written by
# paratools/build_public.py from the local reader. It holds page and
# paragraph numbers only, no text from the editions.
layout: page
title: Passage finder
permalink: /passages/
---

<!-- Your intro text goes here, in Markdown, above the finder. -->

<link rel="stylesheet" href="{{ '/assets/css/passages.css' | relative_url }}">

<div id="passage-finder" class="passages" data-src="{{ '/assets/data/capital-passages.json' | relative_url }}">
  <noscript>The passage finder needs JavaScript.</noscript>
</div>

<script src="{{ '/assets/js/passages.js' | relative_url }}" defer></script>
