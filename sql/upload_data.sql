CREATE TABLE upload_data (
    id          SERIAL PRIMARY KEY,
    category    TEXT NOT NULL,
	  file_name   TEXT NOT NULL,
    header      TEXT[] NOT NULL,
    rows        JSONB NOT NULL,       -- ✅ JSONB 하나 (안에 배열 저장 가능)
    uploaded_at TIMESTAMP DEFAULT now()
);

-- 카테고리별 최신 데이터 빠른 조회
CREATE INDEX idx_upload_category_time
  ON upload_data (category, uploaded_at DESC);

-- JSON 검색 최적화를 위한 GIN 인덱스(선택)
CREATE INDEX idx_upload_rows_gin
  ON upload_data USING gin (rows);
