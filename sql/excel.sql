-- 1. 파일 메타 (파일 자체 정보만)
CREATE TABLE excel_files (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT now()
);

-- 2. 시트 메타 (파일 내 여러 시트)
CREATE TABLE excel_sheets (
  id SERIAL PRIMARY KEY,
  file_id INT NOT NULL REFERENCES excel_files(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(file_id, sheet_name)  -- 같은 파일 안에서 중복 방지
);

-- 3. 행 데이터
CREATE TABLE excel_rows (
  id SERIAL PRIMARY KEY,
  sheet_id INT NOT NULL REFERENCES excel_sheets(id) ON DELETE CASCADE,
  row_index INT,
  row_data JSONB
);

-- 4. 검색 최적화를 위한 GIN 인덱스
CREATE INDEX idx_row_data_gin ON excel_rows USING GIN (row_data jsonb_path_ops);
CREATE INDEX idx_sheet_name    ON excel_sheets(sheet_name);
CREATE INDEX idx_file_name     ON excel_files(file_name);
