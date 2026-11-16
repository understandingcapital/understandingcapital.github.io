# _plugins/gallery_check.rb
#
# Warns when illustrations are missing from _data/gallery.yml.
# Runs on every (re)build, but only in development (i.e. `jekyll serve`
# locally). GitHub Actions builds with JEKYLL_ENV=production, so it stays
# silent there.
#
# Checks:
#   A) Every image in assets/img/illustrations/ is listed in gallery.yml
#      (and every gallery entry points to a file that exists).
#   B) Every image referenced under a "## Illustrations" or
#      "## Visualizations" heading in a post is listed in gallery.yml.
#      If such a section has no recognisable image, the post's URL must
#      appear as some entry's episode_url instead.
#
# Opting out:
#   - _data/gallery_ignore.yml : a plain list of image paths to skip, e.g.
#       - /assets/img/illustrations/some-draft.svg
#   - gallery_skip: true       : in a post's front matter, skips check B
#                                for that post.

require "set"

module GalleryCheck
  ILLUSTRATION_DIR = "assets/img/illustrations"
  IMAGE_EXTS = %w[.png .jpg .jpeg .gif .svg .webp .avif].freeze
  SECTION_RE = /\A##\s+(Illustrations?|Visualizations?)\s*\z/i
  # ![alt](path) or ![alt](path "title"), optionally with <path>
  IMG_RE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/

  module_function

  def external?(path)
    path.to_s.strip =~ %r{\A(https?:)?//}i
  end

  # "/assets/x.svg?v=2#a" -> "assets/x.svg"
  def norm_path(path)
    path.to_s.strip.sub(/[?#].*\z/, "").sub(%r{\A/+}, "")
  end

  # "/posts/ep-14" and "/posts/ep-14/" compare equal
  def norm_url(url)
    norm_path(url).sub(%r{/+\z}, "")
  end

  # Text under each "## Illustrations" / "## Visualizations" heading,
  # up to the next heading of level 1 or 2. Ignores fenced code blocks.
  def sections(content)
    out = []
    current = nil
    in_fence = false
    content.to_s.each_line do |line|
      if line =~ /\A\s*(```|~~~)/
        in_fence = !in_fence
        current << line if current
        next
      end
      level = line[/\A(#+)\s/, 1]&.length
      if !in_fence && line.strip =~ SECTION_RE
        current = +""
        out << current
      elsif !in_fence && level && level <= 2
        current = nil
      elsif current
        current << line
      end
    end
    out
  end

  def run(site)
    gallery = Array(site.data["gallery"]).select { |e| e.is_a?(Hash) }
    ignored = Set.new(Array(site.data["gallery_ignore"]).map { |p| norm_path(p) })

    listed_images = Set.new(gallery.map { |e| norm_path(e["image"]) })
    listed_urls   = Set.new(gallery.map { |e| norm_url(e["episode_url"]) })

    warnings = []

    # --- A: folder vs. gallery -------------------------------------------
    dir = File.join(site.source, ILLUSTRATION_DIR)
    if Dir.exist?(dir)
      Dir.glob(File.join(dir, "**", "*")).sort.each do |file|
        next unless File.file?(file)
        next unless IMAGE_EXTS.include?(File.extname(file).downcase)
        rel = file.sub(%r{\A#{Regexp.escape(site.source)}/?}, "")
        next if listed_images.include?(rel) || ignored.include?(rel)
        warnings << "/#{rel} is in the illustrations folder but not in _data/gallery.yml"
      end
    end

    # --- A (reverse): gallery entries pointing at missing files -----------
    gallery.each do |entry|
      raw = entry["image"].to_s
      next if raw.strip.empty? || external?(raw)
      img = norm_path(raw)
      next if File.exist?(File.join(site.source, img))
      warnings << "gallery entry \"#{entry['title']}\" points to /#{img}, which doesn't exist"
    end

    # --- B: post sections vs. gallery -------------------------------------
    site.posts.docs.each do |post|
      next if post.data["gallery_skip"]
      secs = sections(post.content)
      next if secs.empty?

      title = post.data["title"] || post.basename
      images = secs.join.scan(IMG_RE).flatten
                   .reject { |p| external?(p) }
                   .map { |p| norm_path(p) }
                   .uniq

      if images.empty?
        next if listed_urls.include?(norm_url(post.url))
        warnings << "\"#{title}\" has an Illustrations/Visualizations section, but no gallery entry links to #{post.url}"
      else
        images.each do |img|
          next if listed_images.include?(img) || ignored.include?(img)
          warnings << "\"#{title}\" uses /#{img}, which is not in _data/gallery.yml"
        end
      end
    end

    if warnings.empty?
      Jekyll.logger.info "Gallery check:", "all illustrations are in gallery.yml"
    else
      warnings.uniq.each { |w| Jekyll.logger.warn "Gallery check:", w }
    end
  rescue StandardError => e
    # Never break the build over a check.
    Jekyll.logger.warn "Gallery check:", "skipped (#{e.class}: #{e.message})"
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  GalleryCheck.run(site) if Jekyll.env == "development"
end
