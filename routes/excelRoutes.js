import express from 'express';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import { pool } from '../db.js';
import { exec } from 'child_process';
import { UPLOAD_DIR, HEADER_KEYWORDS, getUploadDir } from '../config.js';

const router = express.Router();

// --------- 삭제 ---------
router.delete('/file/:fileName', async (req, res) => {
  const { fileName } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM excel_files WHERE file_name = $1 RETURNING *',
      [fileName]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const searchDir = await getUploadDir(1, 'search');
    const filePath = path.join(searchDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});


// ---------여러개 업로드 ---------
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.excelFile) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const searchDir = await getUploadDir(1, 'search');
    const files = Array.isArray(req.files.excelFile)
      ? req.files.excelFile
      : [req.files.excelFile];

    const saved = [];

    for (const file of files) {
      // 1) 파일 저장 (선택)
      const safeName = Buffer.from(file.name, 'binary').toString('utf8');
      const savePath = path.join(searchDir, safeName);
      
      await file.mv(savePath);
      saved.push(safeName);

      // 2) excel_files 테이블에 파일 메타 저장
      const { rows: [fileRow] } = await pool.query(
        'INSERT INTO excel_files (file_name) VALUES ($1) RETURNING id',
        [safeName]
      );
      const fileId = fileRow.id;

      // 3) 엑셀 파싱 후 **보이는 시트만** 저장
      const wb = xlsx.readFile(savePath);

      for (const sheetName of wb.SheetNames) {
        // 숨김 시트는 meta.Hidden !== 0
        const sheetMeta = wb.Workbook?.Sheets?.find(s => s.name === sheetName);
        const isVisible = !sheetMeta || sheetMeta.Hidden === 0;
        if (!isVisible) continue; // ❗ 숨김 시트는 skip

        // 시트 메타 저장
        const { rows: [sheetRow] } = await pool.query(
          'INSERT INTO excel_sheets (file_id, sheet_name) VALUES ($1, $2) RETURNING id',
          [fileId, sheetName]
        );
        const sheetId = sheetRow.id;

        // 시트 행 데이터 → JSON 배열
        const sheet = wb.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: '',
        });
        if (!rows.length) continue;

        // 파라미터 바인딩으로 bulk insert
        const placeholders = [];
        const params = [];
        rows.forEach((row, idx) => {
          const base = idx * 3;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
          params.push(sheetId, idx, JSON.stringify(row));
        });

        await pool.query(
          `INSERT INTO excel_rows (sheet_id, row_index, row_data)
           VALUES ${placeholders.join(', ')}`,
          params
        );
      }
    }

    res.json({ success: true, files: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload + DB insert failed' });
  }
});

// --------- 엑셀 파일 리스트 취득 ---------
router.get('/fileList', async (_, res) => {
  try {
    const sql = `
      SELECT f.file_name, ARRAY_AGG(s.sheet_name ORDER BY s.id) AS sheet_list
      FROM excel_files f
      JOIN excel_sheets s ON f.id = s.file_id
      GROUP BY f.file_name
      ORDER BY f.file_name;
    `;
    const { rows } = await pool.query(sql);

    // 기존 응답 형식에 맞게 successFiles / errorFiles 로 반환
    const successFiles = rows.map(r => ({
      fileName: r.file_name,
      sheetList: r.sheet_list
    }));
    res.json({ successFiles, errorFiles: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB file list failed' });
  }
});

// --------- 엑셀 파일 헤더 리스트 취득 ---------
router.get('/searchHeader', async (_, res) => {
  try {
    // JSON 배열 내부의 각 값에서 공백 제거 후 키워드와 매칭
    // → 모든 행을 스캔하지 않도록 GIN 인덱스 + 조건 사용
    const keywords = HEADER_KEYWORDS; // 예: ['상품명','단위',...]
    const likeClauses = keywords
      .map((_, i) => `row_data::text ILIKE $${i + 1}`)
      .join(' OR ');
    const params = keywords.map(k => `%${k}%`);

    const sql = `
      SELECT f.file_name, s.sheet_name, r.row_index, r.row_data
      FROM excel_rows r
      JOIN excel_sheets s ON r.sheet_id = s.id
      JOIN excel_files  f ON s.file_id = f.id
      WHERE ${likeClauses}
      ORDER BY f.file_name, s.sheet_name, r.row_index;
    `;

    const { rows } = await pool.query(sql, params);

    const result = rows.map(r => ({
      sheetInfo: { fileName: r.file_name, sheetName: r.sheet_name },
      headerCell: r.row_data      // JSON 배열 그대로 반환
    }));

    res.json({ result, errorSheets: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB header search failed' });
  }
});

// --------- 엑셀 파일 키워드 검색 ---------
// 열 번호를 Excel 열 문자로 바꾸는 간단 함수 (xlsx 의 encode_col 사용해도 됨)
function colToLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

router.post('/search', async (req, res) => {
  const { keyword, selectedFileList = [], selectedSheetList = [] } = req.body;

  // ── 1. 조건별 파라미터와 where 절 구성 ──
  const params = [];
  const where = [];

  // 키워드(필수)
  params.push(`%${keyword}%`);
  where.push(`elem.value ILIKE $${params.length}`);

  // 파일명 필터 (선택)
  if (selectedFileList.length) {
    params.push(selectedFileList.map(f => f.value));
    where.push(`f.file_name = ANY($${params.length})`);
  }

  // 시트명 필터 (선택)
  if (selectedSheetList.length) {
    params.push(selectedSheetList.map(s => s.key || s.value || s));
    where.push(`s.sheet_name = ANY($${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT
      f.file_name,
      s.sheet_name,
      r.row_index,
      elem.ordinality - 1 AS col_index,  -- 0-based column index
      elem.value          AS cell_value,
      r.row_data
    FROM   excel_rows r
    JOIN   excel_sheets s ON r.sheet_id = s.id
    JOIN   excel_files  f ON s.file_id  = f.id
    JOIN   jsonb_array_elements_text(r.row_data) WITH ORDINALITY AS elem(value, ordinality) ON TRUE
    ${whereSql}
    ORDER BY f.file_name, s.sheet_name, r.row_index, col_index
  `;

  try {
    const { rows } = await pool.query(sql, params);

    // ── 2. 프론트가 기대하는 응답 포맷으로 변환 ──
    const results = rows.map(r => ({
      file: r.file_name,
      sheetName: r.sheet_name,
      cell: `${colToLetter(r.col_index)}${r.row_index + 1}`,
      list: r.row_data,                      // JSON 배열 그대로 전달
      value: r.cell_value
    }));

    res.json([
      {
        searchResult: results,
        errorSheetList: [] // DB 기반이므로 에러 시트는 없거나 필요 시 채움
      }
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB search failed' });
  }
});

// --------- 엑셀 열기/위치 조정 ---------
router.post('/runBatchFile', async (req, res) => {
  const { fileName, sheetName, cellAddress } = req.body;
  if (!fileName || !sheetName || !cellAddress)
    return res.status(400).json({ error: 'fileName, sheetName, cellAddress required' });

  const searchDir = await getUploadDir(1, 'search');

  const vbs = path.join(process.cwd(), 'openExcel.vbs');
  const filePath = path.join(searchDir, fileName);
  const cmd = `cscript //nologo "${vbs}" "${filePath}" "${sheetName}" "${cellAddress}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    console.log(stdout);
    res.json({ success: true });
  });
});

export default router;
