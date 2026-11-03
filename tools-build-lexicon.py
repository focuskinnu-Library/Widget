import json, re

raw = json.load(open('dict_raw.json'))
WORD = re.compile(r"^[a-z][a-z'-]{1,19}$")
ATTRIB = re.compile(r'\s*"[^"]{0,120}"\s*[A-Z][a-z]{2,12}\.\s*$')

def clean(d):
    d = re.sub(r'\s+', ' ', str(d or '')).strip()
    d = re.sub(r'^Defn:\s*', '', d)
    d = re.sub(r'\s*(Etym:|Note:|Syn\.?\s*--|Usage:).*$', '', d)
    d = re.sub(r'\[[^\]]*\]', '', d)
    d = re.sub(r'^\([^)]{0,40}\)\s*', '', d)
    d = re.sub(r'^\d+\.\s*', '', d)                    # drop "1." numbering
    d = ATTRIB.sub('', d)                              # drop ' "quote." Shak.'
    d = re.sub(r'\s+', ' ', d).strip(' ;:,"')
    if not d: return ''
    # first real sentence: a full stop followed by space+capital, or the end
    m = re.search(r'^(.{15,170}?[.!?])(?=\s+[A-Z0-9"(]|$)', d)
    s = (m.group(1) if m else d).strip()
    s = re.sub(r'^\d+\.\s*', '', s)
    s = ATTRIB.sub('', s)
    s = re.sub(r'\s*"[^"]{0,120}"\s*$', '', s).strip()
    if len(s) > 170:
        s = s[:168].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return s.strip()

out = {}
for w, d in raw.items():
    w = w.strip().lower()
    if not WORD.match(w): continue
    c = clean(d)
    if len(c) < 12 or c.lower().startswith('see '): continue
    out[w] = c

# Webster's 1913 predates a lot of ordinary modern vocabulary.
MODERN = {
 "liminal":"adjective — occupying a threshold; between two states, neither one nor the other.",
 "ersatz":"adjective — an inferior substitute standing in for the real thing.",
 "petrichor":"noun — the smell of rain falling on dry earth.",
 "serendipity":"noun — the luck of finding something good without looking for it.",
 "zeitgeist":"noun — the mood and ideas particular to a period of history.",
 "schadenfreude":"noun — pleasure taken in someone else's misfortune.",
 "sonder":"noun — the realisation that every passer-by has a life as vivid as your own.",
 "limerence":"noun — the involuntary, obsessive state of being newly in love.",
 "hiraeth":"noun — a longing for a home you cannot return to, or that never was.",
 "saudade":"noun — a deep, nostalgic longing for something absent and loved.",
 "gaslight":"verb — to make someone doubt their own memory or sanity.",
 "doomscroll":"verb — to keep reading bad news long past the point it helps.",
 "cottagecore":"noun — an aesthetic romanticising rural simplicity and domestic craft.",
 "enshittification":"noun — the slow decay of a platform as it squeezes its own users.",
 "parasocial":"adjective — of a one-sided intimacy felt toward someone who does not know you.",
 "solastalgia":"noun — distress at the change or loss of a place you still live in.",
 "apricity":"noun — the warmth of the sun in winter.",
 "susurration":"noun — a soft murmuring or rustling.",
 "eigengrau":"noun — the dark grey the eye sees in perfect darkness.",
 "kintsugi":"noun — the art of mending broken pottery with gold, so the break is shown.",
 "wabi-sabi":"noun — beauty found in impermanence and imperfection.",
 "ikigai":"noun — the thing that makes life feel worth getting up for.",
 "meraki":"noun — doing something with soul, leaving part of yourself in it.",
 "duende":"noun — the dark, stirring power of a work of art.",
 "mamihlapinatapai":"noun — a shared look between two people each hoping the other will begin.",
}
for w, d in MODERN.items():
    out[w] = d          # the modern sense is the one a reader wants

js = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open('dictwork/lexicon.json','w',encoding='utf-8').write(js)
print('words:', len(out), '| %.1f MB' % (len(js.encode())/1048576))
for p in ['susurrus','liminal','reciprocity','ersatz','fancy','love','quiver','petrichor','gaslight']:
    print(f'  {p:14}', (out.get(p) or '—')[:80])
