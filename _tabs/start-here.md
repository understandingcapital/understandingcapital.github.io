---
layout: page
icon: fas fa-play
order: 1
title: Start From Beginning
---

{% assign episodes = site.posts
  | where_exp: 'item', 'item.hidden != true'
  | where_exp: 'item', 'item.seq'
  | sort: 'seq' %}

{% for post in episodes %}
- [{{ post.title }}]({{ post.url | relative_url }}) — {{ post.date | date: "%b %-d, %Y" }}
{% endfor %}