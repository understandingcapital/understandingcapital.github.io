---
layout: page
icon: fas fa-image
order: 2
title: Illustrations
---

<div class="gallery-grid">
  {% for item in site.data.gallery %}
  <div class="gallery-item">
    <a class="gallery-thumb"
       href="{{ item.image }}"
       target="_blank"
       rel="noopener"
       style="background-image: url('{{ item.image }}');"
       aria-label="{{ item.title }}"></a>
    <div class="gallery-caption">
      <strong>{{ item.title }}</strong>
      <span><a href="{{ item.episode_url }}">{{ item.episode_title }}</a></span>
    </div>
  </div>
  {% endfor %}
</div>

<style>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}
.gallery-item {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
}
.gallery-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.gallery-caption {
  padding: 0.6rem 0.75rem;
}
.gallery-caption strong {
  display: block;
  font-size: 0.9rem;
}
.gallery-caption span {
  display: block;
  font-size: 0.78rem;
  opacity: 0.7;
  margin-top: 0.15rem;
}
.gallery-caption a {
  color: inherit;
  text-decoration: underline;
}
</style>