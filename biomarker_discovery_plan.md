# 膵癌膵液バイオマーカー探索 解析プラン

## 目標
**膵液中のバイオマーカーにより HG-PanIN (CIS) 以上の膵癌を高精度に診断する**

---

## 1. 保有データの整理と位置づけ

| データ | サンプル群 | 主な役割 |
|--------|-----------|---------|
| オルガノイド bulk RNAseq | 良性 / CIS / PDAC | 腫瘍細胞固有の発現変動遺伝子の同定（Discovery） |
| オルガノイド培養上清 proteomics | 良性 / CIS / PDAC | 腫瘍細胞が分泌するタンパク質の網羅的同定（Discovery） |
| 膵液 proteomics | 良性 / CIS | 膵液中に実在するタンパク質の確認（Clinical bridge） |
| Visium 空間トランスクリプトーム | LG-PanIN / CIS / PDAC | 病変部位特異的発現の空間的検証（Spatial validation） |

---

## 2. 解析戦略の全体像

```
Phase 1: Discovery（候補抽出）
  ├─ 1A. オルガノイド RNAseq 差異発現解析
  ├─ 1B. 培養上清 proteomics 差異発現解析
  └─ 1C. Multi-omics 統合

Phase 2: Spatial Validation（空間的検証）
  └─ 2A. Visium による発現局在と病変ステージ依存性の確認

Phase 3: Clinical Bridge（膵液での実在性確認）
  └─ 3A. 膵液 proteomics との照合

Phase 4: Biomarker Panel Construction（パネル構築）
  ├─ 4A. 機械学習によるパネル最適化
  └─ 4B. 性能評価

Phase 5: Validation（検証）★追加データが必要
  ├─ 5A. 独立コホートでの前向き検証
  └─ 5B. 臨床的有用性の評価
```

---

## 3. 各Phase の詳細

### Phase 1: Discovery — 候補バイオマーカーの抽出

#### 1A. オルガノイド bulk RNAseq 差異発現解析

```
目的: 腫瘍細胞が固有に発現変動する遺伝子の同定
比較: (CIS + PDAC) vs 良性 ← 主解析
      CIS vs 良性           ← 早期検出に重要
      PDAC vs CIS           ← 進行度マーカー

手法:
  1. QC → Trimming → Alignment (STAR) → Quantification (featureCounts/Salmon)
  2. DESeq2 / edgeR で差異発現解析
  3. |log2FC| ≥ 1, padj < 0.05 を基準
  4. Secretome annotation (SignalP, SecretomeP, Exocarta) でフィルタ
     → 分泌タンパク質をコードする遺伝子に絞る
  5. GO/KEGG/Reactome enrichment 解析
```

**Key Point**: RNAseq の候補は「分泌タンパク質をコードする」遺伝子に限定する。膵液中に検出可能なものに絞るため。

#### 1B. 培養上清 proteomics 差異発現解析

```
目的: 腫瘍細胞が実際に分泌するタンパク質の同定
比較: 1A と同じ3群比較

手法:
  1. Label-free quantification or TMT 正規化
  2. limma / MSstats で差異発現解析
  3. Fold change + FDR フィルタリング
  4. CIS で既に上昇しているタンパク質を優先
```

**Key Point**: 培養上清データは「腫瘍細胞が実際に細胞外に出すタンパク質」を直接示すため、RNAseq よりも膵液バイオマーカー候補としての信頼性が高い。

#### 1C. Multi-omics 統合

```
目的: RNAseq と proteomics の concordant な候補の抽出

手法:
  1. RNAseq DEG (secretome filtered) と 上清 proteomics DEP の交差
     → 「mRNA レベルでも上昇 + タンパク質として分泌される」候補
  2. RNA-protein 相関解析 (Spearman)
  3. 相関の高い候補を優先的に選択
  4. MOFA (Multi-Omics Factor Analysis) で統合的な因子抽出

優先順位スコアリング:
  Score = w1*(RNA log2FC) + w2*(Protein log2FC) + w3*(RNA-Protein correlation)
        + w4*(CIS specificity) + w5*(Secretion evidence)
```

---

### Phase 2: Spatial Validation — Visium による空間的検証

```
目的: 候補バイオマーカーが病変上皮に特異的に発現することの確認
     （間質由来ではなく腫瘍細胞由来であることの証明）

手法:
  1. SpaceRanger → Seurat/Scanpy で解析
  2. 病理アノテーションに基づくスポット分類
     → Normal duct / LG-PanIN / CIS / PDAC / Stroma
  3. Phase 1 候補遺伝子の各領域での発現量比較
  4. Deconvolution (cell2location, RCTD) で上皮 vs 間質の比率補正
  5. Spatial autocorrelation (Moran's I) で発現パターン解析

期待される結果:
  - CIS/PDAC の上皮スポットで高発現
  - LG-PanIN や間質では低発現
  → 「腫瘍進展に伴い腫瘍上皮細胞が産生する」ことの空間的エビデンス
```

**Key Point**: Visium は LG-PanIN のデータも含むため、「LG-PanIN → CIS で発現が上昇する遺伝子」を同定でき、早期診断マーカーとしての根拠を強化できる。

---

### Phase 3: Clinical Bridge — 膵液 proteomics との照合

```
目的: Phase 1-2 で同定した候補が膵液中に実在することの確認

手法:
  1. Phase 1-2 の候補タンパク質リストと膵液 proteomics を照合
  2. 膵液中で検出されるタンパク質に絞り込み
  3. 膵液中での CIS vs 良性 の比較
     → CIS で有意に上昇するタンパク質を最終候補とする

フィルタリング階層:
  全候補 → 分泌タンパク質 → 培養上清で検出 → 膵液で検出 → CIS で上昇
  (広い)                                                      (狭い)
```

**Critical Gap**: 現在の膵液 proteomics に **PDAC 群が含まれていない**。
→ 追加データとして膵液 proteomics の PDAC サンプルが必要（後述）。

---

### Phase 4: Biomarker Panel Construction

#### 4A. 機械学習によるパネル最適化

```
目的: 最小のマーカー数で最大の診断精度を達成するパネルの構築

手法:
  1. Feature selection
     - LASSO logistic regression (L1 regularization)
     - Random Forest feature importance
     - Boruta algorithm
     - Recursive Feature Elimination (RFE)
  2. 分類器の構築
     - Logistic Regression (解釈性重視)
     - Random Forest / XGBoost (精度重視)
     - Support Vector Machine
  3. 評価
     - Leave-One-Out Cross Validation (LOOCV) ← サンプル数少ない場合
     - Repeated stratified K-fold CV
     - AUC-ROC, Sensitivity, Specificity, PPV, NPV
  4. 最適マーカー数の決定
     - AUC vs マーカー数のプロットで elbow point を探す
     - 臨床実装を考慮し 3-5 マーカーパネルを目標
```

#### 4B. 性能評価基準

```
目標性能 (CIS 以上 vs 良性):
  - AUC ≥ 0.90
  - Sensitivity ≥ 85% (見逃しを最小化)
  - Specificity ≥ 80%

サブ解析:
  - CIS のみ vs 良性 (早期診断性能)
  - PDAC vs 良性 (進行癌診断性能)
  - Stage 別の診断性能
```

---

## 4. 追加で必要なデータ（優先度順）

### 必須（Priority: Critical）

| # | データ | 理由 |
|---|--------|------|
| 1 | **膵液 proteomics — PDAC 群** | 現データに PDAC が欠如。CIS 以上の診断に PDAC の膵液データは必須 |
| 2 | **独立検証コホートの膵液サンプル** | 内部 CV のみでは過学習リスク。別コホートでの検証が論文化に必須 |

### 強く推奨（Priority: High）

| # | データ | 理由 |
|---|--------|------|
| 3 | **膵液 proteomics — LG-PanIN 群** | CIS 特異性の評価。LG-PanIN で陰性なら特異度の根拠が強化される |
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

## 5. 公共データの活用

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

## 6. 解析ワークフロー（時間軸）

```
Month 1-2: Phase 1 — Discovery
  ├── RNAseq 再解析 / QC
  ├── 培養上清 proteomics 再解析
  ├── Multi-omics 統合
  └── 候補リスト v1 作成 (50-100 候補)

Month 2-3: Phase 2 — Spatial Validation
  ├── Visium 解析
  ├── 候補の空間的発現パターン検証
  └── 候補リスト v2 作成 (20-30 候補)

Month 3-4: Phase 3 — Clinical Bridge
  ├── 膵液 proteomics との照合
  ├── CIS vs 良性 の差異確認
  └── 候補リスト v3 作成 (5-15 候補)

Month 4-5: Phase 4 — Panel Construction
  ├── 機械学習モデル構築
  ├── パネル最適化
  └── 3-5 マーカーパネル確定

Month 5-6: Phase 5 — Validation (追加データ取得後)
  ├── 独立コホートでの検証
  ├── PDAC 膵液での検証
  └── 論文化準備

Month 6+: 公共データでの追加検証、論文執筆
```

---

## 7. 最終的なバイオマーカー選定基準

最終候補は以下の全条件を満たすものとする：

```
□ CIS/PDAC オルガノイドで mRNA レベルで有意に上昇
□ CIS/PDAC オルガノイド培養上清でタンパク質として検出・上昇
□ Visium で CIS/PDAC 上皮領域に空間的に限局した発現
□ 膵液 proteomics で実際に検出される
□ 膵液中で CIS ≥ 良性 の差異あり
□ LG-PanIN では上昇しない（あるいは軽度）← 特異性
□ 機械学習パネルでの寄与度が高い
□ 公共データ (TCGA, CPTAC) で再現性あり
□ ELISA/免疫測定法での定量が技術的に可能
```

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| サンプルサイズが小さく過学習 | LOOCV, permutation test, 外部検証コホート |
| オルガノイドと in vivo の乖離 | Visium での空間的検証、公共データでの確認 |
| 膵液に PDAC 群がない | PDAC 膵液サンプルの追加収集（最優先） |
| 候補が膵液中で低存在量 | 高感度 ELISA, proximity extension assay (Olink) での検出 |
| 慢性膵炎での偽陽性 | 慢性膵炎コホートの追加（Priority: Medium） |
| 技術バッチ効果 | ComBat / limma の removeBatchEffect で補正 |

---

## 9. 解析環境・ツール

| 解析 | 主要ツール |
|------|-----------|
| RNAseq 前処理 | STAR, Salmon, featureCounts |
| 差異発現解析 | DESeq2, edgeR, limma |
| Proteomics 解析 | MaxQuant, MSstats, Perseus |
| Spatial transcriptomics | SpaceRanger, Seurat, Scanpy, cell2location |
| Multi-omics 統合 | MOFA2, mixOmics |
| 機械学習 | scikit-learn, glmnet, caret |
| 可視化 | ggplot2, ComplexHeatmap, matplotlib |
| Pathway 解析 | clusterProfiler, fgsea, Reactome |
| 分泌タンパク質予測 | SignalP, SecretomeP, DeepLoc |
