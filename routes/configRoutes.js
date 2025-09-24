import express from 'express';
import os from 'os';
import path from 'path';
import { pool } from '../db.js';
import { UPLOAD_DIR } from '../config.js';

const router = express.Router();
const SYSTEM_USER_ID = 1; // 고정
/**
 * 카테고리별 설정 조회
 *   GET /api/config?userId=1&category=excel   → 단일 카테고리
 *   GET /api/config?userId=1                  → 해당 사용자의 전체 카테고리
 */
router.get('/config', async (req, res) => {
  const { category } = req.query;
  const userId = SYSTEM_USER_ID;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // let sql = `
    //   SELECT category,
    //          folder_path AS "folderPath",
    //          updated_at  AS "updatedAt"
    //   FROM   app_config
    //   WHERE  user_id = $1
    // `;
    // const params = [userId];

    // if (category) {
    //   sql += ` AND category = $2`;
    //   params.push(category);
    // }

    // const { rows } = await pool.query(sql, params);

    // const home = os.homedir();
    // const result = rows.map(r => ({
    //   ...r,
    //   // 홈 디렉터리와 상대 경로를 합친 절대 경로
    //   absolutePath: path.join(home, r.folderPath)
    // }));

    const result = [{absolutePath : UPLOAD_DIR}]

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// router.get('/config', async (req, res) => {
//   const { category } = req.query;
//   const userId = SYSTEM_USER_ID;

//   if (!userId) {
//     return res.status(400).json({ error: 'userId is required' });
//   }

//   try {
//     let sql = `
//       SELECT category,
//              folder_path AS "folderPath",
//              updated_at  AS "updatedAt"
//       FROM   app_config
//       WHERE  user_id = $1
//     `;
//     const params = [userId];

//     if (category) {
//       sql += ` AND category = $2`;
//       params.push(category);
//     }

//     const { rows } = await pool.query(sql, params);

//     const home = os.homedir();
//     const result = rows.map(r => ({
//       ...r,
//       // 홈 디렉터리와 상대 경로를 합친 절대 경로
//       absolutePath: path.join(home, r.folderPath)
//     }));

//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to load config' });
//   }
// });

/**
 * 설정 저장/수정
 *   POST /api/config
 *   body: { userId:1, category:'excel', folderPath:'ExcelFiles' }
 */
router.post('/config', async (req, res) => {
  const { category, folderPath } = req.body;
  const userId = SYSTEM_USER_ID;

  if (!userId || !category || !folderPath) {
    return res.status(400).json({ error: 'userId, category, folderPath are required' });
  }

  try {
    const sql = `
      INSERT INTO app_config (user_id, category, folder_path)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, category)
      DO UPDATE
         SET folder_path = EXCLUDED.folder_path,
             updated_at  = now()
      RETURNING user_id, category, folder_path, updated_at
    `;

    const { rows } = await pool.query(sql, [userId, category, folderPath]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

function resolveUserPath(relativePath) {
  const home = os.homedir(); // e.g. C:\Users\홍길동
  return path.join(home, relativePath);
}

export default router;
