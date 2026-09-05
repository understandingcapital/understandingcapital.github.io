---
layout: page
icon: fas fa-play
order: 1
title: Start From Beginning
---

{% assign visible_posts = site.posts | where_exp: 'item', 'item.hidden != true' %}

{% for post in visible_posts reversed %}
- [{{ post.title }}]({{ post.url }}) — {{ post.date | date: "%b %-d, %Y" }}
{% endfor %}