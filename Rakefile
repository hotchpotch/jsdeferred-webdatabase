
require 'rake'

task :update_sql_abstract => [] do
  orig = nil 
  open('src/jsdeferred-webdatabase.js', 'r') do |f|
    orig = f.read
  end
  source = open('modules/sql-abstract-javascript/src/sql-abstract.js').read
  status = `git submodule status`
  sha1 = nil
  if m = status.match(/[0-9a-f]{40}/)
    sha1 = m[0]
  else
    exit 1
  end

  re = %r{(/\*-- include SQLAbstract --\*/)(.+?)( *)(/\*-- include SQLAbstract end --\*/)}m
  if m = orig.match(re)
    m = m.to_a
    m.shift
    space = m[2].gsub("\n", '')
    m[2] = space
    m[1] = "\n" + space + "/* rev: " + sha1 + " */" + source.split("\n").map {|s| "#{space}#{s}"}.join("\n") + "\n"
    orig.sub!(re, m.join(''))
    open('src/jsdeferred-webdatabase.js', 'w') do |f|
      f.puts orig
    end
  end
end

