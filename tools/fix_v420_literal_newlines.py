from pathlib import Path

# Run after tools/patch_v420.py. Convert only the v4.2 sections from literal \\n sequences to real newlines.
idx=Path('index.html'); jsf=Path('script.js'); cssf=Path('style.css')
index=idx.read_text(encoding='utf-8'); js=jsf.read_text(encoding='utf-8'); css=cssf.read_text(encoding='utf-8')

# HTML: only the inserted Rich Menu manager card.
start=index.find('<div id="line-rich-menu-manager"')
end=index.find('<div class="admin-role-only bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 max-w-2xl">', start+1)
if start<0 or end<0: raise SystemExit('MISSING rich menu HTML block')
segment=index[start:end].replace('\\n','\n')
index=index[:start]+segment+index[end:]

# JS: appended block is at EOF.
mark='\\n\\n// ================================================================\\n// LINE Rich Menu Manager v4.2.0'
pos=js.find(mark)
if pos<0: raise SystemExit('MISSING rich menu JS literal marker')
js=js[:pos]+js[pos:].replace('\\n','\n')

# CSS: appended block is at EOF.
mark2='\\n\\n/* ---------- v4.2.0 LINE Rich Menu Manager ---------- */'
pos2=css.find(mark2)
if pos2<0: raise SystemExit('MISSING rich menu CSS literal marker')
css=css[:pos2]+css[pos2:].replace('\\n','\n')

idx.write_text(index,encoding='utf-8'); jsf.write_text(js,encoding='utf-8'); cssf.write_text(css,encoding='utf-8')
print('fixed v4.2.0 literal newlines')
