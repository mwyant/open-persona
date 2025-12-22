import pathlib

TARGET_ROOT = pathlib.Path("/app")

# JavaScript snippet to inject
INJECT_SNIPPET = """
<script>
(function(){
  // Injected by open-persona overlay: show model used for responses
  function ensureBadge(){
    if (document.getElementById('openpersona-model-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'openpersona-model-badge';
    badge.style.position = 'fixed';
    badge.style.right = '12px';
    badge.style.bottom = '12px';
    badge.style.padding = '8px 12px';
    badge.style.background = 'rgba(0,0,0,0.7)';
    badge.style.color = 'white';
    badge.style.fontSize = '13px';
    badge.style.borderRadius = '8px';
    badge.style.zIndex = 999999;
    badge.innerText = 'Model: unknown';
    document.body.appendChild(badge);
  }

  function updateBadge(md){
    ensureBadge();
    const badge = document.getElementById('openpersona-model-badge');
    const model = md?.model ?? md?.model_id ?? 'unknown';
    const small = md?.small_model ? (' | sub: '+md.small_model) : '';
    const src = md?.resolved_from ? (' ('+md.resolved_from+')') : '';
    badge.innerText = 'Model: ' + model + small + src;
  }

  // Monkeypatch fetch to inspect JSON responses for model_details
  const _fetch = window.fetch;
  window.fetch = function(){
    return _fetch.apply(this, arguments).then(async (resp)=>{
      try{
        const clone = resp.clone();
        const ct = clone.headers.get('content-type') || '';
        if (ct.includes('application/json')){
          const json = await clone.json();
          const md = json?.model_details ?? json?.modelDetails ?? null;
          if (md) updateBadge(md);
        }
      } catch(e){ /* ignore */ }
      return resp;
    });
  };

  // Also try to monitor EventSource SSE data if used by the UI
  const _EventSource = window.EventSource;
  if(_EventSource){
    window.EventSource = function(url, opts){
      const es = new _EventSource(url, opts);
      es.addEventListener('message', function(evt){
        try{
          const data = JSON.parse(evt.data || '{}');
          const md = data?.model_details ?? data?.modelDetails;
          if(md) updateBadge(md);
        }catch(e){}
      });
      return es;
    };
    window.EventSource.prototype = _EventSource.prototype;
  }

})();
</script>
"""

# Find HTML files and inject snippet before </body>

html_files = list(TARGET_ROOT.rglob('*.html'))
if not html_files:
    print('no html files found in /app')
    raise SystemExit(1)

injected = 0
for f in html_files:
    try:
        text = f.read_text(encoding='utf-8')
        if 'openpersona-model-badge' in text:
            continue
        if '</body>' in text.lower():
            new = text.replace('</body>', INJECT_SNIPPET + '\n</body>')
            f.write_text(new, encoding='utf-8')
            injected += 1
    except Exception as e:
        # ignore files we cannot read
        continue

print(f'injected into {injected} html files')
