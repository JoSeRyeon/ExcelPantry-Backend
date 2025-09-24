import express from 'express'
import { pool } from '../db.js';

const router = express.Router()

/**
 * 최신 업로드된 데이터 조회
 * body: { category: 'menu' }
 * → { header: [...], data: [...] } 반환
 */
router.get('/getFileData', async (req, res) => {
  const category = req.query.category;           // ✅ 쿼리에서 category 추출
  
  if (!category) {
    return res.status(400).json({ error: 'category is required' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, file_name As "fileName", header, rows, uploaded_at As "uploadAt"
         FROM upload_data
        WHERE category = $1
        ORDER BY uploaded_at DESC
        LIMIT 1`,
      [category]
    )

    if (!rows.length) return res.json({ header: [], data: [] });

    // 프론트와 동일한 구조로 응답
    res.json({ id: rows[0].id, fileName: rows[0].fileName, header: rows[0].header, data: rows[0].rows, uploadAt : rows[0].uploadAt  })
  } catch (err) {
    console.error('getFileData error:', err)
    res.status(500).json({ error: 'Failed to fetch data', details: err.message })
  }
})

/**
 * 데이터 저장
 * body: { folderName, fileName, data: { header:[], data:[] } }
 */
router.post("/setFileData", async (req, res) => {
  const { id, category, fileName, data } = req.body;

  // 기본 유효성 검사
  if (
    !category ||
    !fileName ||
    !data ||
    !Array.isArray(data.header) ||
    !Array.isArray(data.data)
  ) {
    return res.status(400).json({
      error: "category, fileName, and data.{header,data} are required",
    });
  }

  try {
    if (id) {
      // ✅ id가 있을 때 : UPDATE
      await pool.query(
        `
        UPDATE upload_data
           SET category    = $1,
               file_name   = $2,
               header      = $3,
               rows        = $4::jsonb,
               uploaded_at = now()
         WHERE id = $5
        `,
        [category, fileName, data.header, JSON.stringify(data.data), id]
      );
    } else {
      // ✅ id가 없을 때 : INSERT (id 컬럼 제외 → SERIAL 자동 증가)
      await pool.query(
        `
        INSERT INTO upload_data (category, file_name, header, rows)
        VALUES ($1, $2, $3, $4::jsonb)
        `,
        [category, fileName, data.header, JSON.stringify(data.data)]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("setFileData error:", err);
    res.status(500).json({
      error: "Failed to insert/update data",
      details: err.message,
    });
  }
});

/**
 * 여러 카테고리 조회 (기존 getMultiFileData 대체)
 * body: { fileArray: [{fileName:'menu.json', key,label}], selectedDate, quarter }
 * → 각 카테고리 최신 데이터 중 selectedDate/quarter 조건을 맞춰 응답
 */
router.get('/getMultiFileData', async (req, res) => {
  // ✅ category 파라미터가 여러 개일 수 있음
  // 예: /getMultiFileData?category=menu&category=ingredients
  let { category } = req.query;

  // category가 단일 문자열일 수도 있고, 배열일 수도 있음
  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }
  if (!Array.isArray(category)) {
    category = [category];   // 단일 값이면 배열로 변환
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT DISTINCT ON (category)
             id,
             category,
             file_name  AS "fileName",
             header,
             rows,
             uploaded_at AS "uploadAt"
        FROM upload_data
       WHERE category = ANY($1::text[])
       ORDER BY category, uploaded_at DESC
      `,
      [category]
    );

    // 카테고리별 최신 데이터만 반환 (DISTINCT ON + ORDER BY uploaded_at DESC)
    // 결과를 {category: {...}} 형태로 묶어주면 프론트에서 사용하기 편리
    const result = {};
    rows.forEach(r => {
      result[r.category] = {
        id: r.id,
        fileName: r.fileName,
        header: r.header,
        data: r.rows,
        uploadAt: r.uploadAt
      };
    });

    res.json(result);
  } catch (err) {
    console.error('getFileData error:', err);
    res.status(500).json({ error: 'Failed to fetch data', details: err.message });
  }
});



export default router
