# 原作データを取り除いたことについて（ja ブランチ）

このブランチ（ja）は、日本語対応版のウルティマIII です。原作のゲームのデータは配布しません。
遊ぶときは、GOG.com か Steam で販売されている「Ultima 3」（DOS 版）のファイルを読み込みます
（`web/src/data/dosGame.ts`）。

そのため、2026-11-13 に、このブランチの**すべての履歴**から、原作のデータが入るファイルを取り除きました。
履歴を書き換えたので、このブランチのコミットの番号は、もとにした移植版のものと一致しません。

## 取り除いたもの

| 場所 | 中身 |
| --- | --- |
| `Lairware/Resources/`（古い履歴では `Resources/`） | Macintosh 版の資源: 地図・人・会話などの資源ファイル、文の表、他機種の絵柄、曲、効果音 |
| `Lairware/Images/`（古い履歴では `Images/`） | Macintosh 版の絵（タイトルのロゴ、場面の絵、手引きの表など） |
| `web/public/data/` | 上の資源から作った `resources.json`（地図・人・会話・表・文） |
| `web/public/graphics/` の一部 | 他機種（Apple II・C64・NES・Mac・PC EGA/MCGA/VGA・PC Ultima V）の絵柄、Macintosh 版の絵、元のロゴをもとにした絵、古い字の絵 |
| `web/public/music/`、`web/public/sounds/*.wav` | 曲（原作の曲の編曲）と Macintosh 版の効果音 |
| `web/public/images/Exodus.png`、`SosariaMap.jpg` | 元のロゴと、ソサリアの地図の絵 |
| `web/public/boot.jpg`、`share.jpg`、`web/art/box/`、`promo/`、`desktop/build/steam/` | パッケージの絵と、それをもとにした絵 |
| アイコン（`desktop/build/icon.png`、`web/public/pwa-*.png` など）の古い版 | 元のロゴを使っていたもの。今のアイコンは新しく描いたもの |

残しているのは、移植版のコード（MIT ライセンス）と、移植版が自分で描いた絵（Standard の絵柄、PC CGA の枠の絵、洞窟の天井の絵）、
合成の効果音、日本語の字の表です。PC CGA の絵柄と、文・地図などは、遊ぶときにプレイヤーのゲームのファイルから作ります。

## 開発のときの注意

- 試験と道具は、ゲームのフォルダ（環境変数 `U3_GAME_DIR`、または GOG Galaxy・Steam の入れ場所）からゲームを読みます
  （`web/tools/gameFiles.ts`）。
- `web/tools/dos-strings.py` は、文の表の並びを知るために、取り除いた `resources.json` を使います。作り直すときは、
  もとにした移植版（synthwave-pixel/ultima3）の `web/public/data/resources.json` を別に取ってきて渡してください。
- もとにした移植版を取り込むときは、取り除いたファイルが戻ってこないように確かめてください。
