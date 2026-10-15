# 声部功能识别 · 标注页演示版

在线查看：<https://echo-sculpture.github.io/voice-function-annotation/>

这是本机标注工作台的静态演示版。每条分轨在每一拍（或每一小节）上的声部功能用颜色和高度画出来：主旋律、叠奏、副旋律、和弦伴奏、音型伴奏、休止。

演示版的限制：

- 曲目表里标 ♪ 的 6 首可以播放（MoisesDB 曲目表第 5 到第 10 首），其余歌只有标注和波形。
- 可以在页面上试着改标记，但不会保存，刷新就恢复原样。
- 重新识别、改网格、对齐模式只在本机版里有。
- 第二个分区“重生成结果”只放了 Suno 分轨的第一首（放克）：原曲、原分轨和 ACE-Step 重生成的版本放在一起对比着听。听感标记可以点，但不会保存。

## Demo (English)

A static demo of a beat-level voice-function annotation tool for multitrack music. Each stem is labelled per beat (or per bar) as lead melody, doubling, counter-melody, chordal accompaniment, figurative accompaniment, or rest. The six songs marked ♪ can be played; the others show labels and waveforms only. Edits are not saved.

## Data and license

- Audio and stems are from **MoisesDB** (Pereira et al., *MoisesDB: A Dataset for Source Separation Beyond 4-Stems*, ISMIR 2023), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The audio here was re-encoded to Opus at 96 kbps; nothing else was changed.
- The labels and waveform data in this repository are released under the same license, [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), for non-commercial research use.
- The Suno collection in the label page shows labels and waveforms only. The regeneration page includes one Suno song (Funk): the Suno-generated mix and stems, plus stems regenerated with ACE-Step 1.5.
