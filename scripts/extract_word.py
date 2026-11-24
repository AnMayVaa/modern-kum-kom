"""Export the Kum-Kom dictionary from word.mdb to src/data/words.json.

    pip install access-parser
    python scripts/extract_word.py path/to/word.mdb

access-parser reads the Access file directly, so no Microsoft Access driver is needed.
A few entries in word.mdb hold two words, a bracketed variant or a stray digit or comma;
those are split and cleaned. Duplicates are removed and the list is sorted.
"""

import json
import os
import re
import sys
import unicodedata

from access_parser import AccessParser

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'word.mdb')
OUTPUT = os.path.join(HERE, '..', 'src', 'data', 'words.json')


def clean(raw_words):
    out = set()
    for word in raw_words:
        if not isinstance(word, str):
            continue
        for token in re.split(r'[\s,()]+', unicodedata.normalize('NFC', word)):
            token = re.sub(r'[0-9]+', '', token).strip()
            if token and all('ก' <= ch <= '๎' for ch in token):
                out.add(token)
    return sorted(out)


def main():
    raw = AccessParser(SOURCE).parse_table('Dictionary')['wordID']
    words = clean(raw)
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(w, ensure_ascii=False) for w in words) + '\n]\n')
    print(f'{len(raw)} entries in word.mdb -> {len(words)} words in {os.path.relpath(OUTPUT)}')


if __name__ == '__main__':
    main()
