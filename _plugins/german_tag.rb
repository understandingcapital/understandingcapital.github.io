# frozen_string_literal: true

module Jekyll
  class GermanTag < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @cite = nil

      if markup =~ /cite\s*=\s*["']([^"']+)["']/
        @cite = Regexp.last_match(1)
      end
    end

    def render(context)
      text = super.strip

      site = context.registers[:site]
      converter = site.find_converter_instance(
        Jekyll::Converters::Markdown
      )

      rendered = converter.convert(text).strip

      citation_html = if @cite
        %(<span class="german-note-citation">#{@cite}</span>)
      else
        ""
      end

      html = <<~HTML
        <span class="german-note">
          <span class="german-note-marker"
                tabindex="0"
                role="note">
            <span class="german-note-lang">DE</span>
            #{citation_html}
            <span class="german-note-popup">#{rendered}</span>
          </span>
        </span>
      HTML

      # Tell Liquid/Jekyll this is already-rendered HTML.
      Liquid::Utils.to_s(html)
    end
  end

  Liquid::Template.register_tag("german", GermanTag)
end
