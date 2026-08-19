# frozen_string_literal: true

module Jekyll
  class GermanTag < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @cite = nil

      # Parse: {% german cite="MEW 23:119" %}
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

      # Markdown produces <p>...</p>. Since the popup lives inside
      # an inline element, turn those paragraphs into block spans.
      rendered = rendered
        .gsub("<p>", '<span class="german-note-paragraph">')
        .gsub("</p>", "</span>")

      citation = if @cite
        %(<span class="german-note-citation">#{@cite}</span>)
      else
        ""
      end

      <<~HTML
        <span class="german-note">
          <span class="german-note-marker"
                tabindex="0"
                role="note">
            <span class="german-note-lang">DE</span>#{citation}
            <span class="german-note-popup">#{rendered}</span>
          </span>
        </span>
      HTML
    end
  end

  Liquid::Template.register_tag("german", GermanTag)
end
