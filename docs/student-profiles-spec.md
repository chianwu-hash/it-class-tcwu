# student_profiles 規格文件

更新日期：2026-03-19

## 目的

本文件定義學生主檔 `student_profiles` 的角色、欄位、權限與後台整合方向。

它的目標是解決目前後台只能依靠 `email` 辨識學生的問題，讓老師能看到：

- 班級
- 座號
- 姓名
- 學號樣式代碼（例如 `30108`）

## 設計原則

### 1. 以 `auth.users.id` 為唯一主鍵

學生主檔必須與 Supabase Auth 帳號一對一對應。

因此：

- `user_id` = `auth.users.id`

### 2. email 作為輔助欄位，不作為主鍵

雖然目前後台多半使用 email 搜尋，但 email 不應成為主鍵，也不應成為資料關聯依據。

### 3. 後台優先顯示人類可讀識別資訊

後台主要顯示：

- `student_code + display_name`

例如：

- `30108 王小明`

email 作為補充資訊。

### 4. 第一版先由老師維護

先不要設計成學生自行輸入班級座號姓名。

原因：

- 小學生資料品質不穩
- 容易打錯
- 後台之後較難清理

## 建議欄位

### 必要欄位

- `user_id uuid primary key`
- `email text`
- `class_code text`
- `seat_no smallint`
- `display_name text`
- `student_code text`
- `role text`
- `updated_at timestamptz`

### 欄位說明

#### `user_id`

- 對應 `auth.users.id`
- 唯一主鍵

#### `email`

- 保留學生登入 email
- 方便搜尋與比對

#### `class_code`

- 班級代碼
- 例如：`301`、`302`、`601`

#### `seat_no`

- 座號
- 建議限制為正整數

#### `display_name`

- 學生姓名

#### `student_code`

- 方便老師辨識的代碼
- 建議由 `class_code + 兩位座號` 組成
- 例如：`30108`

#### `role`

- 第一版先支援：
  - `student`
  - `teacher`

#### `updated_at`

- 最後更新時間

## student_code 規則

### 建議生成方式

若：

- `class_code = 301`
- `seat_no = 8`

則：

- `student_code = 30108`

也就是：

- 班級代碼
- 加上兩位數座號（`LPAD(seat_no::text, 2, '0')`）

### 為什麼保留實體欄位

雖然 `student_code` 可以動態算，但第一版直接存欄位比較務實：

- 後台顯示容易
- 搜尋容易
- 匯出 CSV 容易

## 權限原則

### 學生

學生應只能：

- 讀自己的 profile
- 更新自己的 profile（若未來開放）

### 教師

教師應可：

- 查看全部學生 profile
- 新增 / 修改學生 profile

### 第一版策略

為降低風險，第一版建議：

- 保留學生可讀自己資料
- 教師透過 `security definer` function 管理全部學生資料

不要直接把全表開給前端查詢。

## 與後台整合方式

### 第一階段

先不改後台 UI，只先建立資料層。

### 第二階段

將後台學生欄位改成：

- 主顯示：`student_code display_name`
- 次顯示：`email`

### 第三階段

支援：

- 依班級篩選
- 依姓名搜尋
- 依座號搜尋

## 與 student_progress 的關係

未來後台查詢學生進度時，應優先使用：

- `student_progress sp`
- `left join student_profiles prof on prof.user_id = sp.user_id`

後台顯示時的欄位優先順序建議：

1. `student_code`
2. `display_name`
3. `email`

若 `student_profiles` 尚未建立資料，再退回顯示 email。

## 建議的後台 API / RPC

### 1. `admin_list_student_profiles`

用途：

- 查全部學生主檔
- 支援依班級與關鍵字搜尋

### 2. `admin_upsert_student_profile`

用途：

- 教師新增或更新學生主檔

### 3. 後續可考慮

- `admin_delete_student_profile`
- `admin_import_student_profiles`

## 驗收條件

第一版只要達成以下目標即可：

1. `student_profiles` 表能建立
2. RLS / function 權限正確
3. 教師可透過 RPC 取得學生主檔
4. 教師可透過 RPC 更新學生主檔
5. 之後後台可安全接入，不需再重改資料層

## 暫不處理

這一版先不做：

- 學生自行編輯資料 UI
- 後台匯入 CSV
- 後台表格直接顯示姓名
- 成績計算

這些留到下一階段。
