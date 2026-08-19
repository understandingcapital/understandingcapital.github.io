# frozen_string_literal: true

module Jekyll
  class GermanTag < Liquid::Block
    Syntax = /([^\s]+(?:\s+[^\s]+)*)/

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

      # Render Markdown inside the quotation, if desired.
      rendered = converter.convert(text).strip

      citation = @cite || ""

      <<~HTML
        <span class="german-note">
          <span class="german-note-marker"
                tabindex="0"
                role="note">
            <span class="german-note-lang">DE</span><span class="german-note-citation">#{citation}</span>
            <span class="german-note-popup">#{rendered}</span>
          </span>
        </span>
      HTML
    end
  end

  Liquid::Template.register_tag("german", GermanTag)
end
