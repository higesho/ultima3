# 移植版の文字列表（Messages など）の各文を、DOS 版（GOG・Steam の Ultima III）のどこから読むかの表を作る。
# 出力: src/data/dosStrings.json と src/i18n/ja-dos.tsv。英文そのものは書き出さない（番地と、英文の指紋だけ）。
#
#   python tools/dos-strings.py <ゲームのフォルダ> <元の resources.json> <DOS 版の訳 ja.txt>
#
# 元の resources.json は、LairWare 版のデータから作っていたもの（git の履歴にある）。文の並び（何番目が何の文か）を
# 知るためだけに使う。DOS 版の訳 ja.txt は、DOS 版日本語化の訳（「E.95a7<TAB>訳」「YEW.0<TAB>訳」）。
import difflib
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
game, lw_path, dos_ja_path = sys.argv[1:4]

FILES = {'B': 'BOOTUP.BIN', 'E': 'EXODUS.BIN'}
BIN = {k: open(os.path.join(game, f), 'rb').read() for k, f in FILES.items()}
LW = json.load(open(lw_path, encoding='utf-8'))['strings']

# 移植版が自分で持つ表（LairWare の名前の一覧、Mac の声の名前）
OWN_TABLES = {'Female', 'Male', 'Intersex', 'TilesVoices'}


# ---- 英文の指紋（src/i18n/hash.ts の textHash と同じ計算）----
def imul(a, b):
    return (a * b) & 0xFFFFFFFF


def text_hash(s):
    h1, h2 = 0xDEADBEEF, 0x41C6CE57
    u = s.encode('utf-16-le')
    for i in range(0, len(u), 2):
        c = u[i] | (u[i + 1] << 8)
        h1 = imul(h1 ^ c, 2654435761)
        h2 = imul(h2 ^ c, 1597334677)
    h1 = imul(h1 ^ (h1 >> 16), 2246822507)
    h1 ^= imul(h2 ^ (h2 >> 13), 3266489909)
    h2 = imul(h2 ^ (h2 >> 16), 2246822507)
    h2 ^= imul(h1 ^ (h1 >> 13), 3266489909)
    n = 4294967296 * (2097151 & h2) + h1
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    out = ''
    while True:
        n, r = divmod(n, 36)
        out = digits[r] + out
        if not n:
            return out


def squeeze(s):
    return re.sub(r'\s+', ' ', s).strip()


# ---- DOS 版の文（参照される番地 = 単位。DOS 版日本語化の en_all.tsv と同じ）----
def units():
    """{(f, ファイル内の位置): 英文}  0 で終わる、表示できる字の並び"""
    res = {}
    for f, d in BIN.items():
        for m in re.finditer(rb'[\x0a\x10\x11\x20-\x7e]{2,}(?=\x00)', d):
            res[(f, m.start())] = m.group().decode('latin-1')
    return res


UNITS = units()
NORM_UNITS = {k: re.sub(r'\s+', ' ', v).strip().lower() for k, v in UNITS.items()}


def find_exact(s, nocase=False):
    b = s.encode('latin-1', 'replace')
    flags = re.I if nocase else 0
    for f, d in BIN.items():
        # 文の頭（前が 0）から終わり（後ろが 0）まで一致するものを先に、次に文の中の一部
        for pat in (rb'(?<=\x00)' + re.escape(b) + rb'(?=\x00)', re.escape(b)):
            m = re.search(pat, d, flags)
            if m:
                return [f, m.start(), len(b)]
    return None


def at(text, to_end=False):
    """DOS 版の中の、この英文の位置 → [ファイル, 位置, 長さ]（to_end なら 0 まで）"""
    b = text.encode('latin-1')
    for f, d in BIN.items():
        i = d.find(b)
        if i >= 0:
            return [f, i, None if to_end else len(b)]
    raise SystemExit('DOS 版に見つからない: %r' % text)


OWN = None   # 移植版の文のまま
# 手で決めたもの: 表と番号 → 出どころ（[ファイル, 位置, 長さ]、長さ None は 0 まで）、{'cat': [...]}（つなげる）、
# OWN（移植版の文のまま）。似た文の自動の選びが外れたものと、文の一部だけを使うもの
OVERRIDES = {
    ('Messages', 58): OWN,                                        # None! (Done! ではない)
    ('Messages', 80): OWN,                                        # Not owned!
    ('Messages', 109): at(' A ship was\n   Destroyed!\n'),          # 後ろの飾り 0x10 を除く
    ('Messages', 170): OWN,                                       # INVALID CMD!
    ('Messages', 191): at('Rations:\n', to_end=True),             # 見出しの「Ye local Grocer」は 190 が出す
    ('Messages', 205): at('\nWelcome to the\nWeapons Shop!', to_end=True),
    ('Messages', 215): at('\nWelcome to the\nArmour Shop!', to_end=True),
    ('Messages', 241): {'cat': [at(' moves\n'), at('Report thy feat!')]},
    ('Messages', 259): OWN,                                       # Not enough room!
    ('MoreMessages', 1): OWN,
    ('MoreMessages', 5): OWN,
    ('MoreMessages', 6): OWN,
    ('MoreMessages', 7): OWN,
    ('MoreMessages', 8): OWN,
    ('MoreMessages', 9): OWN,
    ('MoreMessages', 40): OWN,
    ('MoreMessages', 42): at('Calm  Wind'),
    ('MoreMessages', 53): at('Press <Space>'),
    ('MoreMessages', 81): at('Mark of Snake'),
}


def fuzzy(s):
    n = re.sub(r'\s+', ' ', s).strip().lower()
    best, score = None, 0
    for k, v in NORM_UNITS.items():
        r = difflib.SequenceMatcher(None, n, v).ratio()
        if r > score:
            best, score = k, r
    return best, score


def screen_text(s):
    """DOS の字形どおりに: ` は ' に、]I[ は III に見える（src/data/dosGame.ts の dosText と同じ）"""
    return s.replace('`', "'").replace(']I[', 'III')


def dos_text(spec):
    f, o, n = spec
    d = BIN[f]
    e = d.index(0, o) if n is None else o + n
    return screen_text(d[o:e].decode('latin-1'))


# ---- 移植版の訳（ja.tsv）を、i18n/index.ts と同じ引き方で ----
def load_ja(path):
    exact, any_case, together = {}, {}, {}
    for line in open(path, encoding='utf-8').read().split('\n'):
        line = line.rstrip('\r')
        if not line or line.startswith('#') or '\t' not in line:
            continue
        en, ja = line.split('\t', 1)
        ja = ja.replace('\\n', '\n').replace('\\t', '\t')
        if en.startswith('re:'):
            continue
        key = en.replace('\\n', '\n').replace('\\t', '\t')
        exact[key] = ja
        any_case.setdefault(key.lower(), ja)
        if re.search(r'\s', key):
            together[squeeze(key)] = re.sub(r'\n+', '', ja).strip()
    return exact, any_case, together


JA = load_ja(os.path.join(WEB, 'src', 'i18n', 'ja.tsv'))


def lookup(text):
    exact, any_case, together = JA
    if text in exact:
        return exact[text]
    m = re.match(r'^(\s*)([\s\S]*?)(\s*)$', text)
    core = m.group(2)
    if core and core != text and core in exact:
        return m.group(1) + exact[core] + m.group(3)
    if core:
        if core.lower() in any_case:
            return m.group(1) + any_case[core.lower()] + m.group(3)
        if squeeze(core) in together:
            return m.group(1) + together[squeeze(core)] + m.group(3)
    return None


def load_dos_ja(path):
    res = {}
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#') or '\t' not in line:
            continue
        k, t = line.split('\t', 1)
        for a in ('{c}', '{r}', '{l.}', '{l}'):
            if t.startswith(a):
                t = t[len(a):]
        res[k] = t.replace('\\n', '\n').replace('{10}', '').replace('{11}', '')
    return res


DOS_JA = load_dos_ja(dos_ja_path)

# ---- 表を作る ----
spec_out = {}
ja_out = {}   # 英文 → 訳（書き出すときは指紋にする）
report = []
for table, items in LW.items():
    out = []
    for i, s in enumerate(items):
        key = (table, i)
        spec = None
        how = ''
        if key in OVERRIDES:
            spec = OVERRIDES[key]
            how = 'manual'
        elif table in OWN_TABLES or len(s.strip()) <= 2:
            spec = None
            how = 'own'
        elif table == 'TilesPlural' and find_exact(s) is None:
            # 複数形は単数形（Tiles の同じ番号）に s / es を足す（DOS 版も怪物の名前にそう足す）
            one = LW['Tiles'][i]
            spec = {'p': i, 'x': s[len(one):]} if s.startswith(one) and s[len(one):] in ('s', 'es') else None
            how = 'plural' if spec else 'own'
        else:
            spec = find_exact(s)
            how = 'exact'
            if spec is None:
                spec = find_exact(s, nocase=True)
                how = 'nocase'
            if spec is None:
                (f, o), score = fuzzy(s)
                if score >= 0.75:
                    spec = [f, o, None]
                    how = 'fuzzy %.2f' % score
                else:
                    how = 'own (best %.2f %r)' % (score, UNITS[(f, o)])
        if isinstance(spec, dict) and 'cat' in spec:
            text = ''.join(dos_text(p) for p in spec['cat'])
            out.append(spec)
            ja = lookup(s)
            if ja is not None and text != s:
                ja_out[text] = ja
            report.append('%s\t%d\t%s\t%r\t->\t%r\t%s' % (table, i, how, s, text, 'ja:port' if ja else 'NO JA'))
        elif isinstance(spec, list):
            text = dos_text(spec)
            out.append(spec)
            if text != s:
                ja = lookup(s)
                src = 'port'
                if ja is None and spec[2] is None:
                    ja = DOS_JA.get('%s.%04x' % (spec[0], spec[1] + 0x100))
                    src = 'dos'
                if ja is not None:
                    ja_out[text] = ja
                report.append('%s\t%d\t%s\t%r\t->\t%r\t%s' % (table, i, how, s, text, ('ja:' + src) if ja else 'NO JA'))
        else:
            out.append({'s': s} if not isinstance(spec, dict) else spec)
            report.append('%s\t%d\t%s\t%r' % (table, i, how, s))
    spec_out[table] = out


# ---- 会話（町・城・地下牢のファイル）の訳 ----
TALK_FILES = ['BRITISH', 'EXODUS', 'LCB', 'MOON', 'YEW', 'MONTOR_E', 'MONTOR_W', 'GREY', 'DAWN', 'DEVIL', 'FAWN', 'DEATH',
              'M', 'FIRE', 'TIME', 'P', 'PERINIAN', 'MINE', 'DARDIN', 'AMBROSIA']
for name in TALK_FILES:
    data = open(os.path.join(game, name + '.ULT'), 'rb').read()
    toff = 0x1000 if len(data) == 4648 else 0x800
    first = struct.unpack_from('<H', data, toff)[0]
    n = min(8, first // 2) if first else 0
    for k in range(n):
        o = struct.unpack_from('<H', data, toff + 2 * k)[0]
        p = toff + o
        if o == 0 or p >= len(data):
            continue
        e = data.find(b'\0', p)
        text = screen_text(data[p:e].decode('latin-1'))
        ja = DOS_JA.get('%s.%d' % (name, k))
        if ja is not None:
            ja_out[text] = ja
        else:
            report.append('talk %s.%d NO JA %r' % (name, k, text))

json.dump(spec_out, open(os.path.join(WEB, 'src', 'data', 'dosStrings.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
lines = ['# DOS 版から読む文の訳: @e/@l/@r<TAB>英文の指紋<TAB>訳（tools/dos-strings.py が作る。手で直さない）',
         '# @e はそのまま、@l は小文字にした英文、@r は空白と改行を1つの空白にした英文の指紋（i18n/index.ts の引き方）']
for en, ja in ja_out.items():
    lines.append('@e\t%s\t%s' % (text_hash(en), ja.replace('\n', '\\n')))
    lines.append('@l\t%s\t%s' % (text_hash(en.lower()), ja.replace('\n', '\\n')))
    if re.search(r'\s', en):
        lines.append('@r\t%s\t%s' % (text_hash(squeeze(en)), re.sub(r'\n+', '', ja).strip()))
open(os.path.join(WEB, 'src', 'i18n', 'ja-dos.tsv'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
open(os.path.join(HERE, 'dos-strings-report.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
print('表', {k: len(v) for k, v in spec_out.items()}, '訳', len(ja_out))
