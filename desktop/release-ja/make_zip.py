# 日本語版のリリースの zip を作る: ゲームのフォルダに展開して置くだけで動く形
#   python release-ja/make_zip.py <版>   （desktop で npm run dist:win をしたあとに）
# 中身: Ultima3JP.exe（ポータブル版）、LICENSE.txt、はじめにお読みください.txt
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DESKTOP = os.path.dirname(HERE)
version = sys.argv[1]
exe = os.path.join(DESKTOP, 'dist', 'Ultima-III-%s-win-x64-portable.exe' % version)
out = os.path.join(DESKTOP, 'dist', 'Ultima3_App_JP.zip')


def text(path):
    """メモ帳で読めるように、BOM つき UTF-8・改行は CRLF"""
    t = open(path, encoding='utf-8').read().replace('\r\n', '\n').replace('\n', '\r\n')
    return b'\xef\xbb\xbf' + t.encode('utf-8')


with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    z.write(exe, 'Ultima3JP.exe')
    z.writestr('LICENSE.txt', text(os.path.join(DESKTOP, '..', 'LICENSE')))
    z.writestr('はじめにお読みください.txt', text(os.path.join(HERE, 'はじめにお読みください.txt')))
print(out, os.path.getsize(out))
