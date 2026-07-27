  ---
  layout: page
  icon: fas fa-play
  order: 1
  title: Start Here
  ---
  {% for post in site.posts reversed %}
  - [{{ post.title }}]({{ post.url }}) — {{ post.date | date: "%b %-d, %Y" }}
  {% endfor %}