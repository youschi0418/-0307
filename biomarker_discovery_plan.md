# 膵癌膵液バイオマーカー探索 解析プラン（ハイブリッド版）

## 目標
**膵液中のバイオマーカーにより HG-PanIN (CIS) 以上の膵癌を高精度に診断する**

---

## 1. 保有データの整理と位置づけ

| データ | サンプル群 | 本プランでの役割 |
|--------|-----------|-----------------|
| Visium 空間トランスクリプトーム | LG-PanIN / CIS / PDAC | **Step 1: 候補抽出の起点**（病変ステージ依存的に変動する遺伝子の同定） |
| オルガノイド bulk RNAseq | 良性 / CIS / PDAC | **Step 2: 分泌可能性フィルタ**（腫瘍細胞固有の発現変動を確認） |
| オルガノイド培養上清 proteomics | 良性 / CIS / PDAC | **Step 2: 分泌可能性フィルタ**（実際に分泌されるタンパク質の直接的証拠） |
| 膵液 proteomics | 良性 / CIS | **Step 3: 膵液での絞り込み**（膵液中に実在し、CIS で変動するかの確認） |

---

## 2. 解析戦略の全体像

```
Step 1: Visium で候補抽出（Discovery — 起点）
  ├── 病変ステージ依存的 DEG の同定
  ├── 空間的に腫瘍上皮に限局する発現の確認
  └── → 候補 50-100 遺伝子

Step 2: オルガノイドデータで「分泌可能性」フィルタ
  ├── 培養上清 proteomics で実際に分泌されるか
  ├── RNAseq で CIS/PDAC 上昇を再現するか
  └── → 候補 15-30 タンパク質

Step 3: 膵液 網羅的 proteomics で絞り込み
  ├── 膵液中に検出されるか
  ├── CIS vs 良性 で差異があるか
  └── → 候補 5-10 タンパク質

Step 4: 膵液 ターゲット定量で検証・パネル構築
  ├── ELISA / MRM / PRM / Olink で定量
  ├── サンプル数を拡大して診断性能評価
  └── → 最終パネル 3-5 マーカー
```

**設計思想**: Visium を起点とすることで「in vivo の病変組織で、進展に伴い発現が変化する」という最も説得力のあるストーリーを構築する。オルガノイドデータは起点ではなく「分泌可能性フィルタ」として活用し、膵液で見つからない候補を追いかける無駄を排除する。

---

## 3. 各Step の詳細

### Step 1: Visium で候補抽出（Discovery）

#### 1A. Visium データの前処理と領域アノテーション

```
目的: 空間的に分解された遺伝子発現データを病理学的領域に対応づける

手法:
  1. SpaceRanger によるアライメントと遺伝子発現定量
  2. Seurat / Scanpy による QC・正規化・次元削減・クラスタリング
  3. 病理医アノテーションに基づくスポット分類:
     → Normal duct / LG-PanIN / CIS (HG-PanIN) / PDAC / Stroma
  4. Deconvolution (cell2location, RCTD) で各スポットの細胞組成を推定
     → 上皮成分比率の高いスポットに解析を限定可能
```

#### 1B. 病変ステージ依存的な差異発現遺伝子（DEG）の同定

```
目的: LG-PanIN → CIS → PDAC の進展に伴い発現が変化する遺伝子の同定

主要比較:
  (1) CIS vs LG-PanIN  ← 最重要: CIS 以上の検出に直結
  (2) CIS vs Normal duct
  (3) PDAC vs LG-PanIN
  (4) Trend 解析: Normal → LG-PanIN → CIS → PDAC の経時的変動

手法:
  1. 各領域間の DEG 解析 (Wilcoxon / MAST / negative binomial)
  2. |log2FC| ≥ 0.5, padj < 0.05 を基準（Visium はノイズが大きいため閾値は緩めに）
  3. Trajectory / Trend 解析で段階的上昇パターンを示す遺伝子を抽出
  4. Spatial autocorrelation (Moran's I) で空間的に一貫した発現パターンを確認
  5. 上皮スポットに限局し、間質スポットでは低発現の遺伝子を優先

フィルタリング基準:
  □ CIS/PDAC 上皮スポットで有意に高発現
  □ LG-PanIN では低発現（あるいは CIS と有意差あり）
  □ 間質スポットでは低発現（腫瘍上皮由来の証拠）
  □ 空間的に病変領域に限局（散在的でない）

→ 候補リスト v1: 50-100 遺伝子
```

**Key Point**: Visium データは LG-PanIN / CIS / PDAC の3ステージを含むため、**「LG-PanIN → CIS の変化点で上昇する遺伝子」**を同定できる。これは CIS 以上を検出するバイオマーカーの根拠として最も直接的なエビデンスであり、本データの最大の強み。

---

### Step 2: オルガノイドデータで「分泌可能性」フィルタ

#### 2A. 培養上清 proteomics による分泌タンパク質の確認

```
目的: Step 1 の候補遺伝子がコードするタンパク質が、
     腫瘍細胞から実際に分泌されるかを直接的に確認する

手法:
  1. Step 1 の候補遺伝子リスト（50-100）に対応するタンパク質を
     培養上清 proteomics のデータセットで検索
  2. 検出されたタンパク質について:
     - CIS/PDAC vs 良性 で差異発現解析 (limma / MSstats)
     - CIS で既に上昇しているものを優先
  3. 検出されなかったタンパク質について:
     - 膜結合型 or 細胞内タンパク質の可能性 → 優先度を下げる
     - ただし低存在量の分泌タンパク質の可能性もあるため完全除外はしない

判定:
  ◎ 培養上清で検出 + CIS/PDAC で上昇 → 最優先候補
  ○ 培養上清で検出 + 差異なし         → 中程度の優先度
  △ 培養上清で未検出                   → 低優先度（ただし除外はしない）
```

#### 2B. オルガノイド RNAseq での再現性確認

```
目的: Visium で同定した候補が、オルガノイド（純粋な腫瘍細胞）でも
     再現されることを確認する

手法:
  1. Step 1 候補の発現量をオルガノイド RNAseq で確認
  2. CIS/PDAC vs 良性 の差異発現解析 (DESeq2)
  3. Visium とオルガノイドで concordant に上昇する遺伝子を優先

意義:
  - Visium は間質の混入があるため、オルガノイド（純粋な腫瘍細胞）で
    再現されれば「腫瘍細胞固有のシグナル」であることの強い証拠
  - Visium のみで上昇 → 間質由来の可能性あり → フラグを立てる
```

#### 2C. 分泌タンパク質予測による追加フィルタ

```
目的: in silico で分泌可能性を予測し、候補をさらに精緻化

手法:
  1. SignalP 6.0: シグナルペプチドの有無（古典的分泌経路）
  2. SecretomeP 2.0: 非古典的分泌経路の予測
  3. DeepLoc 2.0: タンパク質の細胞内局在予測
  4. ExoCarta / Vesiclepedia: エクソソーム含有タンパク質データベースとの照合

統合フィルタリング:
  Step 1 候補 (50-100)
    → 培養上清で検出 (◎○) or 分泌予測陽性 (SignalP/SecretomeP)
    → オルガノイド RNAseq で再現
    → 候補リスト v2: 15-30 タンパク質
```

**Key Point**: このステップの本質は「Visium 候補の中から膵液に出てくる可能性が高いものを事前選別する」こと。培養上清データは「腫瘍細胞が実際に外に出すタンパク質」を直接示すため、in silico 予測よりも信頼性の高いフィルタとして機能する。

---

### Step 3: 膵液 網羅的 proteomics で絞り込み

```
目的: Step 2 で絞り込んだ候補が膵液中に実在し、
     CIS で変動することを確認する

手法:
  1. Step 2 の候補タンパク質リスト（15-30）と膵液 proteomics を照合
  2. 膵液中で検出されるタンパク質に絞り込み
  3. CIS vs 良性 の比較:
     - 差異発現解析 (limma / MSstats)
     - Fold change + 統計的有意差でランキング
  4. 検出頻度（何例中何例で検出されたか）も考慮
     → 高頻度で検出されるものほどバイオマーカーとして実用的

フィルタリング階層（Step 1 からの累積）:
  Visium DEG (50-100)
    → 培養上清で検出 or 分泌予測陽性 (15-30)
      → 膵液で検出 (10-20)
        → 膵液中 CIS vs 良性 で差異あり (5-10)
           → 候補リスト v3

追加解析:
  - 膵液 proteomics で Step 1-2 を経ずに CIS vs 良性 で差異のある
    タンパク質も別途リスト化（hypothesis-free な発見として）
  - Step 1-2 の候補と膵液独自候補を比較し、overlap を確認
```

**Critical Gap**: 現在の膵液 proteomics に **PDAC 群が含まれていない**。
→ PDAC の膵液 proteomics データの追加収集が必要（Section 5 参照）。
→ 当面は CIS vs 良性 の比較で候補を選定し、PDAC データ取得後に検証する。

---

### Step 4: 膵液 ターゲット定量で検証・パネル構築

#### 4A. ターゲット定量プラットフォームの選定

```
候補プラットフォーム（目的に応じて選択）:

1. ELISA / Luminex
   - 長所: 確立された方法、臨床実装しやすい、コスト低い
   - 短所: 抗体が必要、多重化に限界
   - 推奨: 最終検証・臨床実装フェーズ

2. MRM / PRM (targeted mass spectrometry)
   - 長所: 抗体不要、高い特異性、多重化可能
   - 短所: 感度が ELISA に劣る場合あり、専用機器が必要
   - 推奨: Step 3 → Step 4 の橋渡し（中間検証）

3. Olink (Proximity Extension Assay)
   - 長所: 高感度、少量検体で多重定量可能
   - 短所: パネルが固定、カスタムパネルはコスト高
   - 推奨: 候補が Olink パネルに含まれる場合

推奨戦略:
  候補 5-10 → MRM/PRM で中間検証 → 候補 3-5 に絞る → ELISA で最終検証
```

#### 4B. サンプルサイズ拡大と診断性能評価

```
目的: 候補パネルの診断性能を統計的に信頼性の高い形で評価

手法:
  1. Step 3 までのサンプルに加え、新規サンプルで定量
     - 良性膵疾患: n ≥ 30
     - CIS (HG-PanIN): n ≥ 20
     - PDAC: n ≥ 30
  2. 単独マーカーおよびパネルとしての診断性能評価
     - AUC-ROC
     - Sensitivity / Specificity at optimal cutoff (Youden index)
     - PPV / NPV
  3. パネル構築
     - LASSO logistic regression で最適マーカー組合せを選定
     - AUC vs マーカー数のプロットで最適数を決定
     - 3-5 マーカーパネルを目標
  4. 内部検証
     - Leave-One-Out Cross Validation (LOOCV)
     - Repeated stratified 5-fold CV
     - Bootstrap (1000回) で信頼区間算出
     - Permutation test で偶然の一致を除外

目標性能 (CIS 以上 vs 良性):
  - AUC ≥ 0.90
  - Sensitivity ≥ 85%（見逃しを最小化）
  - Specificity ≥ 80%

サブグループ解析:
  - CIS のみ vs 良性（早期診断性能 — 最重要）
  - PDAC vs 良性（進行癌診断性能）
  - IPMN サブタイプ別（取得可能であれば）
```

---

## 4. 各Step における候補の絞り込みフロー（まとめ）

```
全遺伝子
  │
  ▼ Step 1: Visium — 空間的候補抽出
  │  ・CIS/PDAC 上皮で高発現
  │  ・LG-PanIN → CIS で上昇
  │  ・間質では低発現
  │
  50-100 遺伝子
  │
  ▼ Step 2: オルガノイド — 分泌可能性フィルタ
  │  ・培養上清で分泌が確認される
  │  ・オルガノイド RNAseq で発現上昇を再現
  │  ・分泌タンパク質予測が陽性
  │
  15-30 タンパク質
  │
  ▼ Step 3: 膵液 proteomics — 臨床検体での確認
  │  ・膵液中に検出される
  │  ・CIS vs 良性 で有意に上昇
  │
  5-10 タンパク質
  │
  ▼ Step 4: ターゲット定量 — パネル構築・検証
  │  ・MRM/PRM → ELISA で定量
  │  ・LASSO で最適パネル選定
  │  ・独立コホートで検証
  │
  最終パネル 3-5 マーカー
```

---

## 5. 追加で必要なデータ（優先度順）

### 必須（Priority: Critical）

| # | データ | 理由 |
|---|--------|------|
| 1 | **膵液 proteomics — PDAC 群** | 現データに PDAC が欠如。CIS 以上の診断に PDAC の膵液データは必須 |
| 2 | **独立検証コホートの膵液サンプル** | 内部 CV のみでは過学習リスク。別コホートでの検証が論文化に必須 |

### 強く推奨（Priority: High）

| # | データ | 理由 |
|---|--------|------|
| 3 | **膵液 proteomics — LG-PanIN 群** | CIS 特異性の評価。LG-PanIN で陰性なら特異度の根拠が強化 |
| 4 | **正常膵組織の scRNAseq / snRNAseq** | 正常膵管上皮でのベースライン発現確認。偽陽性の排除に有用 |
| 5 | **血清/血漿 proteomics** | 膵液採取は侵襲的。血液でも検出可能なら臨床的価値が飛躍的に向上 |

### 推奨（Priority: Medium）

| # | データ | 理由 |
|---|--------|------|
| 6 | **scRNAseq（腫瘍組織 CIS / PDAC）** | Visium の解像度補完。個々の細胞レベルでの発現確認 |
| 7 | **IPMN（低リスク/高リスク）の膵液** | IPMN 経過観察中の悪性転化予測への応用拡大 |
| 8 | **慢性膵炎の膵液 proteomics** | 主要な鑑別疾患。慢性膵炎で偽陽性にならないことの確認 |
| 9 | **他の体液（十二指腸液, 胆汁）** | 膵液以外の低侵襲検体での検出可能性の探索 |

### あれば有用（Priority: Low）

| # | データ | 理由 |
|---|--------|------|
| 10 | **Methylation / cfDNA データ** | マルチモーダルパネルでの精度向上。タンパク質+DNA の組合せ |
| 11 | **Public dataset (TCGA-PAAD, CPTAC)** | in silico での候補遺伝子の発現検証 |
| 12 | **患者背景・臨床情報** | 交絡因子の調整、サブグループ解析 |

---

## 6. 公共データの活用

追加実験を行わずとも、以下の公共データで候補の外部検証が可能：

```
1. TCGA-PAAD (RNAseq + Clinical)
   → 候補遺伝子の PDAC 高発現確認、予後との関連

2. CPTAC Pancreatic Cancer (Proteomics + RNAseq)
   → 組織レベルでの RNA-タンパク質相関の検証

3. GEO / ArrayExpress の膵液/膵管上皮データセット
   → 候補の再現性確認

4. Human Protein Atlas
   → 正常組織での発現分布、膵臓特異性の確認

5. GTEx
   → 正常組織での発現レベル確認（膵液偽陽性リスクの評価）
```

---

## 7. 解析ワークフロー（時間軸）

```
Month 1-2: Step 1 — Visium Discovery
  ├── Visium データ前処理・QC
  ├── 病理アノテーションと領域分類
  ├── Deconvolution
  ├── DEG 解析（LG-PanIN vs CIS vs PDAC）
  └── 候補リスト v1 作成 (50-100 遺伝子)

Month 2-3: Step 2 — オルガノイド分泌可能性フィルタ
  ├── 培養上清 proteomics との照合
  ├── オルガノイド RNAseq での再現性確認
  ├── 分泌タンパク質予測 (SignalP, SecretomeP, DeepLoc)
  └── 候補リスト v2 作成 (15-30 タンパク質)

Month 3-4: Step 3 — 膵液 proteomics 絞り込み
  ├── 膵液 proteomics との照合
  ├── CIS vs 良性 の差異確認
  └── 候補リスト v3 作成 (5-10 タンパク質)

Month 4-6: Step 4 — ターゲット定量・パネル構築
  ├── MRM/PRM による中間検証
  ├── ELISA による最終定量
  ├── LASSO でパネル最適化
  └── 3-5 マーカーパネル確定

Month 6-8: 検証・論文化
  ├── 独立コホートでの外部検証
  ├── PDAC 膵液データでの検証（追加データ取得後）
  ├── 公共データでの追加検証
  └── 論文執筆

並行作業:
  ├── 公共データ解析 (TCGA, CPTAC, HPA) → Month 1 から随時
  └── PDAC 膵液サンプル収集 → Month 1 から開始
```

---

## 8. 最終的なバイオマーカー選定基準

最終候補は以下の全条件を満たすものとする：

```
□ Visium で CIS/PDAC 上皮領域に空間的に限局した高発現（Step 1）
□ LG-PanIN → CIS で有意な発現上昇（Step 1）
□ CIS/PDAC オルガノイド培養上清でタンパク質として分泌を確認（Step 2）
□ CIS/PDAC オルガノイド RNAseq で mRNA レベルの上昇を再現（Step 2）
□ 膵液 proteomics で実際に検出される（Step 3）
□ 膵液中で CIS vs 良性 で有意差あり（Step 3）
□ ターゲット定量で安定的に測定可能（Step 4）
□ LASSO パネルでの寄与度が高い（Step 4）
□ 公共データ (TCGA, CPTAC) で再現性あり（補助的検証）
□ ELISA/免疫測定法での定量が技術的に可能（臨床実装性）
```

---

## 9. リスクと対策

| リスク | 対策 |
|--------|------|
| Visium の間質混入による偽陽性候補 | Deconvolution + オルガノイドデータでの再現確認（Step 2） |
| Visium の解像度限界（50μm） | scRNAseq 追加取得 or 公共 scRNAseq データでの検証 |
| オルガノイドと in vivo の乖離 | Visium を起点とし、オルガノイドはフィルタとして使用（乖離の影響を最小化） |
| 膵液に PDAC 群がない | PDAC 膵液サンプルの追加収集（最優先） |
| サンプルサイズが小さく過学習 | LOOCV, permutation test, 外部検証コホート |
| 候補が膵液中で低存在量 | 高感度 ELISA, Olink, MRM/PRM での検出 |
| 慢性膵炎での偽陽性 | 慢性膵炎コホートの追加（Priority: Medium） |
| 技術バッチ効果 | ComBat / limma の removeBatchEffect で補正 |

---

## 10. 解析環境・ツール

| 解析 | 主要ツール |
|------|-----------|
| Spatial transcriptomics | SpaceRanger, Seurat, Scanpy, cell2location, RCTD |
| RNAseq 前処理 | STAR, Salmon, featureCounts |
| 差異発現解析 | DESeq2, edgeR, limma, MAST |
| Proteomics 解析 | MaxQuant, MSstats, Perseus |
| Multi-omics 統合 | MOFA2, mixOmics |
| 分泌タンパク質予測 | SignalP 6.0, SecretomeP 2.0, DeepLoc 2.0 |
| 機械学習 | scikit-learn, glmnet, caret |
| 可視化 | ggplot2, ComplexHeatmap, matplotlib, Spatial plots |
| Pathway 解析 | clusterProfiler, fgsea, Reactome |
| ターゲット定量解析 | Skyline (MRM/PRM) |
