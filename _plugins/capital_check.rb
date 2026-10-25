# Checks the Capital edition data in _data/capital/ every time the site builds,
# locally and in GitHub Actions. Any mistake stops the build with a list of
# what is wrong, instead of producing a broken Editions page.
#
# Checks: ids, parents, kinds and page order in each outline; that every id in
# correspondence.yml exists; that each edition's column in `body` is in
# reading order with no gaps; that every heading is covered exactly once.

require 'set'

module CapitalCheck
  EDITIONS = { 'r' => 'reitter', 'f' => 'fowkes', 'm' => 'mew23' }.freeze
  KINDS = %w[front book part part-intro chapter section subsection back].freeze
  ROWKEYS = %w[r f m partial].freeze
  ROMAN = { 'i' => 1, 'v' => 5, 'x' => 10, 'l' => 50, 'c' => 100 }.freeze

  module_function

  def roman(str)
    vals = str.downcase.chars.map { |ch| ROMAN[ch] || 0 }
    vals.each_with_index.sum { |v, i| i + 1 < vals.size && vals[i + 1] > v ? -v : v }
  end

  # Roman front-matter pages sort before arabic ones.
  def pnum(page)
    page.to_s =~ /\A\d+\z/ ? page.to_i : roman(page.to_s) - 10_000
  end

  def parent_ok?(kind, parent_kind)
    case kind
    when 'front' then [nil, 'front'].include?(parent_kind)
    when 'back' then [nil, 'back'].include?(parent_kind)
    when 'book' then parent_kind.nil?
    when 'part' then parent_kind == 'book'
    when 'part-intro', 'chapter' then parent_kind == 'part'
    when 'section' then parent_kind == 'chapter'
    when 'subsection' then %w[section subsection].include?(parent_kind)
    else false
    end
  end

  def validate(data)
    errs = []
    outlines = {}

    EDITIONS.each do |k, name|
      rows = data[name]
      unless rows.is_a?(Array)
        errs << "#{name}.yml is missing or not a list"
        next
      end
      by = {}
      order = {}
      rows.each_with_index do |r, i|
        id = r['id'].to_s
        errs << "#{name}: id #{id.inspect} should start with '#{k}-'" unless id.start_with?("#{k}-")
        errs << "#{name}: duplicate id #{id}" if by.key?(id)
        errs << "#{name}: #{id} has unknown kind #{r['kind'].inspect}" unless KINDS.include?(r['kind'])
        errs << "#{name}: #{id} page should be a quoted string" unless r['page'].is_a?(String)
        p = r['parent']
        if p && !by.key?(p)
          errs << "#{name}: #{id} has parent #{p}, which is missing or comes after it"
        elsif p && pnum(r['page']) < pnum(by[p]['page'])
          errs << "#{name}: #{id} starts before its parent #{p}"
        end
        pk = p && by[p] ? by[p]['kind'] : nil
        errs << "#{name}: #{id} (#{r['kind']}) can't sit under #{pk || 'the top level'}" unless parent_ok?(r['kind'], pk)
        by[id] = r
        order[id] = i
      end
      book = rows.reject { |r| %w[front back].include?(r['kind']) }
      book.each_cons(2) do |a, b|
        errs << "#{name}: page order: #{b['id']} (#{b['page']}) comes after #{a['id']} (#{a['page']})" if pnum(b['page']) < pnum(a['page'])
      end
      parents = rows.map { |r| r['parent'] }.compact.to_set
      leaves = rows.map { |r| r['id'] }.reject { |id| parents.include?(id) }
      outlines[k] = { by: by, order: order, leaves: leaves }
    end
    return errs unless errs.empty?

    corr = data['correspondence']
    unless corr.is_a?(Hash) && corr['body'].is_a?(Array) && corr['apparatus'].is_a?(Array)
      return errs << 'correspondence.yml needs `apparatus:` and `body:` lists'
    end

    m = corr['measure']
    if !m.is_a?(Hash) || !EDITIONS.key?(m['edition'].to_s) || m['end_page'].to_s !~ /\A\d+\z/
      errs << 'correspondence.yml: `measure` needs an edition (r, f or m) and a quoted end_page'
    end

    used = Hash.new { |h, key| h[key] = [] }
    %w[apparatus body].each do |sect|
      corr[sect].each_with_index do |row, i|
        where = "correspondence #{sect} row #{i + 1}"
        unless row.is_a?(Hash)
          errs << "#{where} is not a { r: …, f: …, m: … } entry"
          next
        end
        (row.keys - ROWKEYS).each { |key| errs << "#{where}: unknown field #{key}" }
        EDITIONS.each_key do |k|
          if !row.key?(k)
            errs << "#{where}: missing #{k}: (use null if the edition lacks the text)"
          elsif row[k]
            if outlines[k][:by].key?(row[k])
              used[k] << row[k]
            else
              errs << "#{where}: #{row[k]} is not in #{EDITIONS[k]}.yml"
            end
          end
        end
        Array(row['partial']).each do |k|
          errs << "#{where}: partial lists #{k} but that cell is empty" unless row[k]
        end
      end
    end
    return errs unless errs.empty?

    m_key = m['edition'].to_s
    corr['body'].each_with_index do |row, i|
      errs << "correspondence body row #{i + 1}: the measuring edition (#{m_key}) can't be null" unless row[m_key]
    end

    EDITIONS.each do |k, name|
      o = outlines[k]
      seen = {}
      prev = nil
      corr['body'].each_with_index do |row, i|
        v = row[k]
        next if v.nil?
        errs << "body row #{i + 1}: #{v} is front/back matter; it belongs under apparatus" if %w[front back].include?(o[:by][v]['kind'])
        if v != prev
          errs << "body row #{i + 1}: #{v} appears again after other rows (repeats must be consecutive)" if seen[v]
          errs << "body row #{i + 1}: #{name} goes backwards (#{v} comes before #{prev})" if prev && o[:order][v] < o[:order][prev]
          seen[v] = true
        end
        prev = v
      end

      ancestors = lambda do |id|
        out = []
        cur = o[:by][id]['parent']
        while cur
          out << cur
          cur = o[:by][cur]['parent']
        end
        out
      end
      used_set = used[k].to_set
      o[:leaves].each do |leaf|
        next if used_set.include?(leaf) || ancestors.call(leaf).any? { |a| used_set.include?(a) }
        errs << "#{name}: #{leaf} is not covered by any correspondence row"
      end
      used_set.each do |v|
        a = ancestors.call(v).find { |x| used_set.include?(x) }
        errs << "#{name}: both #{v} and its ancestor #{a} are used; pick one level" if a
      end
    end
    errs
  end
end

if defined?(Jekyll::Hooks)
  Jekyll::Hooks.register :site, :post_read do |site|
    data = site.data['capital']
    next unless data

    errors = CapitalCheck.validate(data)
    if errors.empty?
      Jekyll.logger.info 'Capital data:', "OK (#{data['correspondence']['body'].size} rows)"
    else
      errors.each { |e| Jekyll.logger.error 'Capital data:', e }
      raise "Capital data in _data/capital/ has #{errors.size} problem(s), listed above."
    end
  end
end
