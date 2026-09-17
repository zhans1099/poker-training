# 固定牌局历史牌例摘要（用于修正 AI 人物画像）

> 用途：给 Codex / AI 行为模型作为人物画像校准样本。  
> 原则：只记录已知事实、核心决策结论和画像信号；不确定的信息明确标注，不用结果倒推。  
> 固定局背景：5~6 人，盲注 10/20；初始买入 2000，后续 rebuy 2000 / 4000 / 6000；常见 open 120~180+。  
> 主要玩家画像：Z 极松凶、VPIP 约 90%、爱买牌、顶对不易弃、深水/上头后大尺度动作明显增多；J 偏粘、爱 call；L/P 有一定理论基础、相对理性；H 相对有判断；Hero 在桌上形象偏浪、爱偷，大尺度下注经常被理解为 bluff。

---

## Hand 01 — Hero AKs vs Z QQ（300BB 深筹码）

### 已知事实
- 5 人局。
- Z open 200。
- J call 200。
- Hero 持 **AKs**，3bet 到 **800**。
- H、L fold。
- Z 4bet 到 **1500**。
- Hero 有效筹码约 **6000+**，直接 all-in。
- Z call，摊牌 **QQ**。
- 发两次，Hero 两次都输。

### 核心分析
- Hero 3bet 800：合理。
- Z 从 800 只加到 1500，是很小的 4bet。
- Hero 只需再补约 700 就能继续，价格非常好。
- 在约 300BB 深度下，AKs 直接 shove 6000+ 偏高方差；默认更倾向 **call 4bet**，保留 Z 的 AQ、Axs、KQs、bluff 等较弱范围。
- 不能因为 Z VPIP 90% 就推断他的 4bet / 300BB call-off 范围也同样宽。
- QQ call Hero 300BB shove，受到 Hero “偏浪、爱偷、大尺度像 bluff”桌上形象影响。

### 对人物画像的修正
**Z**
- 至少会用 QQ 接 Hero 的超深筹码 shove。
- 但不能据此推断 JJ/AQ 也一定会 call。
- 需要把 `4betRange` 和 `callOffRange` 与 VPIP 分开建模。

**Hero**
- Leak：拿顶级起手牌时容易把“继续”直接等同于“打光”。
- Leak Tag：`overplay_preflop_deep_stack`、`ignore_call_option`。

---

## Hand 02 — Hero 56 on 4-5-6-A vs Z 37s

### 已知事实
- Hero 有效筹码约 **6000**。
- 翻前 Hero 用 **56** 跟 100 入池。
- Flop：**4-5-6**。
- Z bet 200。
- Hero raise 到 **800**。
- 其他人 fold。
- Z call。
- Turn：**A**，无花完成。
- Z check。
- Hero bet **1500**。
- Z all-in。
- Hero 当时倾向 fold，但最后通过随机数决定 call。
- Hero 当时读 Z 可能为 **A3 / A4 / A5 / A6 / A7**。
- 摊牌 Z 为 **37s**，flop 已成顺。

### 核心分析
- Flop Hero 顶两对，raise 800 合理。
- Turn A 并非完全 blank：A4/A5/A6 都会反超 Hero 两对。
- Hero 下注 1500 可接受，属于 value。
- 面对 Z check-shove，不能只用“Z 很松、爱买牌”解释，必须更新范围。
- 如果 Hero 认为 Z 主要是 A3~A7，则应区分：
  - Hero 领先 A3、A7；
  - Hero 落后 A4、A5、A6；
  - 同时不能忽略 flop 已经成牌的 23 / 37 / 78 / set。
- 事后补充的重要 read：**Z 正常状态下很少做大尺度 all-in，通常只有上头或深水时才明显增加。**
- 因此如果当时 Z 不在 tilt / 深水状态，大 shove 应明显提高强价值牌权重。
- 用随机数替代已经形成的 read 不合理；随机化只有在两个动作 EV 接近时才有意义。

### 对人物画像的修正
**Z**
- 正常状态：大尺度 all-in 更偏强。
- Tilt / 深水状态：大尺度半诈唬、bluff、risk-taking 明显增加。
- 需要动态变量：`tiltLevel`、`sessionProfitLoss`、`lossChasing`。

**Hero**
- 优点：现场 read 已经能捕捉“大尺度动作异常”。
- Leak：分析正确但执行失败；会用随机数替代明确判断。
- Leak Tag：`fail_to_trust_read`、`randomize_without_reason`、`overcall_vs_polarized_range`。

---

## Hand 03 — Hero 37s on 5-6-J-4 vs Z 68

### 已知事实
- Hero 持 **37s**。
- Flop：**5-6-J**，其中 5、6 与 Hero 同花。
- Hero flop 为 **同花听牌 + gutshot**。
- Z bet 200。
- Hero raise 到 **800**。
- Z call。
- Turn：**4**。
- Hero 成 **7-high straight（3-4-5-6-7）**。
- Hero bet **1500**。
- Z all-in。
- Z 摊牌 **68**。
- Z 当时是 pair + draw 类型，并未成顺。

### 核心分析
- Turn Hero 已是强成牌，面对 Z shove 应明显倾向 call。
- 这手提供了一个关键反例：Z 的大 shove **并不只包含成牌/nuts**。
- Z 确实存在拿 **pair + draw / 强半诈唬** 打得非常激进的情况。
- 但这不能机械推翻上一手：需要结合发生时间、Z 是否 tilt、牌面结构和具体动态状态。

### 对人物画像的修正
**Z**
- `semiBluffFrequency` 高。
- 存在 `pair_plus_draw_shove`。
- 大 shove 范围应建模为“价值 + 半诈唬极化”，而不是单纯 nuts。
- 是否大幅增加半诈唬，受 tilt / 深水状态影响。

**Hero**
- 强成牌面对 Z 的极化 shove，不应因为“Z 大尺度偏强”就过度弃牌。
- 需要训练区分：
  - 中等 bluff-catcher；
  - 强成牌；
  - 对手极化范围中自己仍领先多少 value/semi-bluff。

---

## Hand 04 — Hero 99 on 6-7-7-8

### 已知事实
- Z open **120**。
- J call。
- Hero 持 **99**，call。
- Flop：**6-7-7**。
- Z bet 200。
- J call 200。
- Hero raise 到 **1200**。
- Z call。
- J call。
- Turn：**8**。
- Z、J check。
- Hero bet **2200**。
- Z、J fold。
- Z 事后说自己有一张 **8**，具体 kicker 不明。

### 核心分析
- Preflop 99 call：合理。
- Flop 99 是 overpair。
- 对 L/H/P 这类更理性玩家，flop raise 可更小，约 **800**。
- 对 Z/J 这种偏粘玩家，raise 到 **1200** 有 exploit 合理性，因为他们确实会拿更差牌付大价。
- Flop 两家都 call 后，turn pot 约 **3990**。
- Turn Hero 2200 ≈ **55% pot**，并不是超大下注。
- Turn 8 会改善很多 8x、pair+draw，但 99 仍领先大量 8x / 6x / draw。
- 对 Z/J，turn 下注约 **2000~2400** 合理；Hero 实际 2200 在合理区间。
- 若 turn 对手主动大尺度下注或 check-raise，则 99 应从“主动 value”切换为 `call/fold` 类型，不能继续 raise。

### 尺寸建议
**对 L/H/P**
- Flop raise：约 **800**。
- 若两家 call，turn pot 约 2790。
- Turn 建议：**1000~1250**，偏 1100~1200。

**对 Z/J**
- Flop raise：约 **1200**。
- 若两家 call，turn pot 约 3990。
- Turn 建议：**2000~2400**，Hero 实际 2200 合理。

### 对人物画像的修正
**Z/J**
- 对 Hero 的大尺度下注有明显 overcall 倾向。
- “粘”主要体现在 call range 宽，不应自动推导为 raise / shove range 同样宽。

**Hero**
- “Protection”意识偏强，但本手针对 Z/J 的 exploit 有合理性。
- 重点训练：在对手吃下大 raise 后，重新筛选其范围，而不是继续沿用 flop 前的宽范围假设。

---

## Hand 05 — Hero 44 on 2-2-4-Q

### 已知事实
- 5 人 limp 入池。
- Flop 前 pot = **100**。
- Hero 持 **44**。
- Flop：**2-2-4**，Hero 为 **4 full of 2**。
- Z、J check。
- Hero bet **200**。
- H、L fold。
- Z、J call。
- Turn：**Q**。
- Z、J check。
- Hero bet **400**。
- Z、J fold。

### 核心分析
- Hero flop 已是极强葫芦，几乎完全不需要保护。
- Flop 200 into 100 = **2x pot**，作为默认 value sizing 偏大。
- 但针对 Z/J 对 Hero 大尺度下注会过度抓 bluff 的桌上 read，这种 overbet 有 exploit 合理性。
- Z/J 实际都 call，说明该画像至少在这手中成立。
- Turn pot 约 700，Hero bet 400 ≈ **57% pot**，尺度本身合理。
- 若目标是最大化弱牌继续支付，turn 也可略小。
- 更重要的训练点：坚果级别牌不要用“保护”思维，应优先思考如何让更差牌持续付钱。

### 对人物画像的修正
**Z/J**
- 能面对 Hero flop 2x pot 继续，强化其 `heroCallFrequency` / `stickiness`。
- Hero 大尺度下注确实可能触发“他又在偷”的 read。

**Hero**
- Leak：极强牌也倾向过快做大底池。
- Leak Tag：`overbet_nutted_hand`、`miss_thin_value_path`。

---

## Hand 06 — Hero J9o on 9-J-Q，多人 all-in

### 已知事实
- Hero 持 **J9o**。
- 翻前有人小 open，多人入池；Hero 跟入，具体 preflop 尺度不完整。
- Flop：**9-J-Q**。
- Pot 约 **18BB**。
- SB bet **6BB**。
- 上家 call。
- Hero 提前口头宣布 raise 到 **26BB**。
- SB call。
- 上家随后 all-in。
- Hero 再 call / all-in，补款约 **40BB**。
- SB 也 all-in。
- Turn：无关张。
- River：**9**。
- 摊牌：
  - SB：**KQ**
  - 上家：**KT**，flop 已成顺。

### 核心分析
- J9o 翻前跟小 open 偏松。
- Flop 两对很强，raise 有合理性。
- 关键问题是多人继续后必须重新评估范围。
- 对手在知道 Hero 要 raise 的情况下仍然继续，再出现 all-in，范围应明显增强。
- Hero 是否 call 取决于具体 pot odds / 有效筹码；此前分析认为约 40BB 补款使 call 并非完全不可接受，但绝不能只因为自己是两对就自动打光。
- 训练重点：多人底池的强行动必须显著提高顺子 / set / 强两对权重。

### 对 Hero 画像的修正
- Leak：容易被自己的绝对牌力锚定。
- Leak Tag：`fail_to_update_range_multiway`、`overvalue_two_pair`。

---

## Hand 07 — Hero AA on A-J-J

### 已知事实
- Hero 持 **AA**。
- 翻前多人 limp 入池，底池约 **2BB**。
- Hero 没有翻前加注。
- Flop：**A-J-J**。
- Hero bet **3BB**。
- 上家 call。
- Turn：无关张。
- 对手 check。
- Hero bet **4BB**。
- 对手 raise 到 **12BB**。
- Hero call。
- River：无关张。
- 对手 check。
- Hero bet **12BB**。
- 对手 call。
- 摊牌对手为 **Jx**。
- 有效筹码未知。

### 核心分析
- 最大问题不是 postflop，而是 **AA 翻前没有 raise**，损失价值且让多人便宜入池。
- Flop bet 可接受。
- Turn 面对 Jx 倾向明显的 raise，Hero 只 call 可能漏价值；若排除 JJ 极少数组合，可以更激进。
- River 12BB 也偏保守，面对 Jx 可以争取更多价值。
- 这手与前面“极强牌打太快”相反：Hero 在部分绝对强牌 spot 又存在 **价值提取不足**，说明 sizing 不是简单“永远过大”，而是下注目的和范围判断不稳定。

### 对 Hero 画像的修正
- Leak 并非单向：有时过快做大底池，有时又因未充分识别对手强二等牌而漏 value。
- 训练重点：下注尺度必须由“哪些更差牌会继续”决定，而不是由自己牌力强弱直接决定。

---

## Hand 08 — Hero J♣3♣ 强听牌多人底池

### 已知事实（历史记录存在两个版本，不能强行合并）

#### 版本 A
- Hero：**J♣3♣**
- Flop：**8♣ 9♣ Q♦**
- Pot：约 **24BB**
- SB bet 12BB
- BB call
- 上家 raise 到 40BB
- Hero fold
- Turn：**10♣**
- River：**J♦**
- 有效筹码约 30BB 的记录曾出现。

#### 版本 B
- Hero：**J♣3♣**
- Flop：**9♣ T♦ Q♣**
- Pot：约 **30BB**
- SB bet 15BB
- BB call
- 上家 raise 到 **100BB**
- 对手具体手牌存在历史记录不一致，不能当作完全确认事实。

### 核心分析
- Hero 是强听牌，但多人底池 + 前面出现大 raise 时，对手范围显著偏强。
- 低 SPR 下，强 combo draw 可考虑 shove/fold，纯 call 容易留下尴尬的后续 SPR。
- 如果 turn 真完成 J-high flush 且只剩约 30BB，则应积极打光，而不是继续小尺度。
- 该手历史记录有版本冲突，Codex 不应将具体 board / showdown 当作单一绝对事实。

### 对 Hero 画像的修正
- Hero 会拿结构牌 / 强听牌参与多人底池。
- 需要训练：draw 的 equity、SPR、多人池对手范围强度，而不是只看“outs 很多”。

---

## Hand 09 — Hero A♦7♦ 翻前面对超大 raise

### 已知事实
- Hero：**A♦7♦**。
- UTG limp。
- UTG+1 大幅 raise，历史记录为 **200BB**（该尺度异常大，可能原始记录存在单位/口述误差，需保留为不确定）。
- 后面有两位 caller。
- Hero fold。
- Flop：**K♦ 8♦ 2♦**，若入池 Hero 会 flop nut flush。
- 当时 Hero 对 fold 很意难平。

### 核心分析
- 不能因为事后 flop 中坚果同花就反推 preflop fold 错。
- 面对极大 raise + 多人继续，A7s 即便有结构，也可能没有合理直接跟注价格。
- 典型的“结果导向”训练案例。

### 对 Hero 画像的修正
- Hero 会因为“弃牌后本可中大牌”产生 regret。
- Leak Tag：`results_oriented_regret`。
- Review 模型必须明确区分“当时 EV”与“事后 board”。

---

# 汇总：目前最有价值的人物画像信号

## Z
- 极松凶，VPIP 约 90%。
- 喜欢买牌，top pair / draw 粘性高。
- 可以拿 pair + draw 做大尺度 semi-bluff / shove。
- 正常状态下，大尺度 all-in 相对少，价值权重更高。
- 深水 / 连输 / tilt 后，大尺度 aggression、semi-bluff、all-in 频率显著上升。
- 面对 Hero，因为 Hero 有“大尺度像 bluff”的桌上形象，会扩大 bluff-catch。
- Call range 宽，不等于 raise / shove range 同样宽。
- 需要分开建模：VPIP / PFR / 3bet / 4bet / call-off / large-bet / shove / tilt-state aggression。

## J
- 偏粘，call range 宽。
- Hero 大尺度下注时容易怀疑 Hero 偷。
- 当前证据更支持 `heroCallFrequency` 高，而不是主动 bluff / shove 高频。
- 应把“粘”主要体现为 call，不要让模型自动把 J 的 raise range 也做得很宽。

## L / P / H
- 已知真实牌例样本较少。
- L/P：相对理性、有一定理论基础。
- H：较有判断。
- 当前不要过度拟合，应保持参数可调并等待更多真实牌例。

## Hero
当前主要 Leak 不是单一“太松”或“太凶”，而是：

1. **尺度和下注目的不稳定**：有时为 protection 过度放大；极强牌有时又漏 value。
2. **对大动作的执行纪律不足**：已经形成 fold read 后，仍可能 hero call；偶尔用随机数替代理性判断。
3. **范围更新不足**：多人底池对手连续强行动后，没有足够快地把范围收紧。
4. **深筹码过度打光**：AKs 300BB spot 倾向把“继续”直接升级成 shove。
5. **结果导向**：弃牌后若 board 恰好击中，会产生明显 regret。
6. **桌上形象**：其他人普遍认为 Hero 偏浪、爱偷；Hero 大尺度下注越大，越容易被怀疑 bluff；因此 Hero 的 value 大尺度可能获得额外支付，同时纯 bluff 大尺度 EV 会下降。

---

# 给 AI / Codex 的建模要求

请不要把这些牌例直接转换成“固定规则”。

正确用法是：

**真实牌例 -> 画像证据 -> 更新概率先验**

例如：

- 不能因为 Z 曾用 68 shove，就让 Z 所有 pair+draw 都 shove；
- 不能因为 Z QQ call 300BB，就假设 JJ/AQ 一定 call；
- 不能因为 J 粘，就让 J 的主动 raise/shove 也很宽；
- 不能因为 Hero 某次 overbet 有效，就把 Hero 所有 value 都建模成 overbet。

建议每条画像参数维护：

- `confidence`
- `sampleCount`
- `sourceHands`
- `normalStateValue`
- `tiltStateValue`

例如：

```json
{
  "player": "Z",
  "trait": "largeBetSemiBluffFrequency",
  "normalStateValue": 0.18,
  "tiltStateValue": 0.48,
  "confidence": 0.62,
  "sampleCount": 2,
  "sourceHands": ["Hand02", "Hand03"]
}
```

目标不是“复刻某一手牌”，而是让长期模拟行为统计上越来越像真人。
